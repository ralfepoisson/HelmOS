"""Progression-aware conversation analysis for agent testing."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
import hashlib
import math
import re

import httpx

from app.config.settings import get_settings


QUESTION_SPLIT_PATTERN = re.compile(r"(?<=[?])\s+")
CLAIM_SPLIT_PATTERN = re.compile(r"(?<=[.!?])\s+")

ASSUMPTION_CUES = ("assume", "assuming", "believe", "likely", "probably", "might", "may", "think")
CONSTRAINT_CUES = (
    "constraint",
    "budget",
    "pricing",
    "price",
    "onboarding",
    "delivery",
    "service",
    "implementation",
    "timeline",
    "capacity",
    "compliance",
    "integration",
)
CONTRADICTION_CUES = ("contradiction", "conflict", "tension", "inconsistent", "does not fit", "clashes with")
SYNTHESIS_CUES = ("summary", "summarize", "to recap", "core problem", "one sentence", "next step")
NO_CONTRADICTION_CUES = ("no contradictions found", "no contradiction found", "i do not see a contradiction")
NARROWING_CUES = (
    "who specifically",
    "which customer",
    "what evidence",
    "how many",
    "which problem",
    "what problem hurts most",
    "what constraint",
    "what assumption",
    "what contradiction",
    "specifically",
)
DOMAIN_KEYWORDS = {
    "customer",
    "segment",
    "pricing",
    "onboarding",
    "delivery",
    "problem",
    "pain",
    "evidence",
    "market",
    "workflow",
    "integration",
    "startup",
    "cloud",
    "cost",
    "buyer",
    "persona",
    "value",
    "retention",
    "differentiation",
}
STOPWORDS = {
    "a",
    "an",
    "the",
    "is",
    "are",
    "do",
    "does",
    "did",
    "can",
    "could",
    "would",
    "should",
    "we",
    "you",
    "they",
    "it",
    "this",
    "that",
    "there",
    "more",
    "about",
    "tell",
    "me",
    "what",
    "why",
    "how",
    "who",
    "when",
    "where",
    "which",
    "and",
    "for",
    "with",
    "from",
    "into",
    "your",
}


@dataclass(slots=True)
class ConversationState:
    turn_number: int = 0
    extracted_questions: list[str] = field(default_factory=list)
    extracted_claims: list[str] = field(default_factory=list)
    detected_assumptions: list[str] = field(default_factory=list)
    contradictions_found: list[str] = field(default_factory=list)
    information_gain_score_per_turn: list[int] = field(default_factory=list)
    semantic_embeddings_per_turn: list[list[float]] = field(default_factory=list)
    redundant_question_count: int = 0
    target_agent_turns: int = 0
    mode: str = "cooperative"
    stagnation_cycles: int = 0
    stagnation_events: int = 0
    last_stagnation_reason: str | None = None

    def to_metadata(self) -> dict:
        payload = asdict(self)
        payload["semantic_embeddings_per_turn"] = [
            embedding[:8] for embedding in self.semantic_embeddings_per_turn
        ]
        return payload


@dataclass(slots=True)
class TurnProgressionAnalysis:
    turn_number: int
    extracted_questions: list[str]
    extracted_claims: list[str]
    detected_assumptions: list[str]
    contradictions_found: list[str]
    information_gain_score: int
    semantic_embedding: list[float]
    redundant_question: bool
    generic_question: bool
    narrowing_question: bool
    constraint_introduced: bool
    contradiction_surfaced: bool
    similarity_score: float | None
    stagnation_event: bool
    stagnation_reason: str | None
    mode: str
    synthesis_checkpoint_required: bool
    synthesis_checkpoint_satisfied: bool
    contradiction_checkpoint_satisfied: bool
    low_exploration_depth_failure: bool
    failure_reason: str | None = None

    def to_metadata(self) -> dict:
        payload = asdict(self)
        payload["semantic_embedding"] = self.semantic_embedding[:8]
        return payload


class SemanticEmbedder:
    """Simple embedding interface for conversation progression."""

    async def embed(self, text: str) -> list[float]:
        raise NotImplementedError


class HashingSemanticEmbedder(SemanticEmbedder):
    """Deterministic local embedding fallback used for tests and offline runs."""

    def __init__(self, dimensions: int = 24):
        self.dimensions = dimensions

    async def embed(self, text: str) -> list[float]:
        cleaned = text.lower().strip()
        if not cleaned:
            return [0.0] * self.dimensions

        vector = [0.0] * self.dimensions
        for token in re.findall(r"[a-z0-9]+", cleaned):
            digest = hashlib.sha256(token.encode("utf-8")).digest()
            index = digest[0] % self.dimensions
            sign = 1.0 if digest[1] % 2 == 0 else -1.0
            vector[index] += sign

        norm = math.sqrt(sum(value * value for value in vector))
        if norm <= 0:
            return vector
        return [round(value / norm, 6) for value in vector]


class JinaSemanticEmbedder(SemanticEmbedder):
    """Optional Jina-backed embedding adapter for higher quality novelty checks."""

    def __init__(
        self,
        *,
        api_key: str,
        base_url: str,
        model: str,
        dimensions: int,
        timeout_seconds: float = 10.0,
    ):
        self.api_key = api_key
        self.base_url = base_url
        self.model = model
        self.dimensions = dimensions
        self.timeout_seconds = timeout_seconds

    async def embed(self, text: str) -> list[float]:
        async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
            response = await client.post(
                self.base_url,
                headers={"Authorization": f"Bearer {self.api_key}"},
                json={"model": self.model, "input": [text], "dimensions": self.dimensions},
            )
            response.raise_for_status()
            payload = response.json()
        data = payload.get("data") or []
        if not data or not isinstance(data[0], dict) or not isinstance(data[0].get("embedding"), list):
            raise ValueError("Jina embeddings response did not contain a valid embedding.")
        return [float(value) for value in data[0]["embedding"]]


class AgentTestConversationProgressionService:
    """Analyzes conversation progression, novelty, and stagnation."""

    def __init__(self, *, embedder: SemanticEmbedder | None = None):
        self.embedder = embedder or self._default_embedder()

    async def analyze_target_turn(
        self,
        *,
        state: ConversationState,
        turn_number: int,
        message_text: str,
    ) -> TurnProgressionAnalysis:
        questions = self._extract_questions(message_text)
        claims = self._extract_claims(message_text)
        assumptions = self._extract_assumptions(claims)
        contradictions = self._extract_contradictions(message_text)
        constraint_introduced = self._contains_any(message_text, CONSTRAINT_CUES)
        narrowing_question = any(self._is_narrowing_question(question) for question in questions)
        generic_question = bool(questions) and all(self._is_generic_question(question) for question in questions)

        embedding_basis = " ".join(questions) if questions else message_text
        embedding = await self.embedder.embed(embedding_basis)
        similarity_score = self._max_similarity(embedding, state.semantic_embeddings_per_turn[-5:])
        redundant_question = bool(questions) and similarity_score is not None and similarity_score > 0.85

        new_assumptions = [item for item in assumptions if item not in state.detected_assumptions]
        new_contradictions = [item for item in contradictions if item not in state.contradictions_found]

        info_gain = 0
        if new_assumptions:
            info_gain += 1
        if constraint_introduced:
            info_gain += 1
        if new_contradictions:
            info_gain += 2
        if narrowing_question:
            info_gain += 1
        if redundant_question:
            info_gain -= 1
        if generic_question:
            info_gain -= 1

        state.turn_number = turn_number
        state.target_agent_turns += 1
        state.extracted_questions.extend(questions)
        state.extracted_claims.extend(claims)
        state.detected_assumptions.extend(new_assumptions)
        state.contradictions_found.extend(new_contradictions)
        state.information_gain_score_per_turn.append(info_gain)
        state.semantic_embeddings_per_turn.append(embedding)
        if redundant_question:
            state.redundant_question_count += 1

        stagnation_event, stagnation_reason = self._detect_stagnation(state)
        if stagnation_event:
            state.stagnation_events += 1
            state.stagnation_cycles += 1
            state.last_stagnation_reason = stagnation_reason
        else:
            state.stagnation_cycles = 0
            state.last_stagnation_reason = None

        state.mode = "adversarial" if state.target_agent_turns >= 5 or stagnation_event else "cooperative"

        synthesis_checkpoint_required = state.target_agent_turns % 5 == 0
        synthesis_checkpoint_satisfied = self._contains_any(message_text, SYNTHESIS_CUES)
        contradiction_checkpoint_satisfied = bool(new_contradictions) or self._contains_any(
            message_text, NO_CONTRADICTION_CUES
        )
        failure_reason: str | None = None
        low_exploration_depth_failure = False
        if state.stagnation_cycles >= 2:
            low_exploration_depth_failure = True
            failure_reason = "LOW EXPLORATION DEPTH FAILURE"
        elif state.target_agent_turns >= 10 and not state.contradictions_found:
            low_exploration_depth_failure = True
            failure_reason = "LOW EXPLORATION DEPTH FAILURE"

        return TurnProgressionAnalysis(
            turn_number=turn_number,
            extracted_questions=questions,
            extracted_claims=claims,
            detected_assumptions=new_assumptions,
            contradictions_found=new_contradictions,
            information_gain_score=info_gain,
            semantic_embedding=embedding,
            redundant_question=redundant_question,
            generic_question=generic_question,
            narrowing_question=narrowing_question,
            constraint_introduced=constraint_introduced,
            contradiction_surfaced=bool(new_contradictions),
            similarity_score=similarity_score,
            stagnation_event=stagnation_event,
            stagnation_reason=stagnation_reason,
            mode=state.mode,
            synthesis_checkpoint_required=synthesis_checkpoint_required,
            synthesis_checkpoint_satisfied=synthesis_checkpoint_satisfied,
            contradiction_checkpoint_satisfied=contradiction_checkpoint_satisfied,
            low_exploration_depth_failure=low_exploration_depth_failure,
            failure_reason=failure_reason,
        )

    def _default_embedder(self) -> SemanticEmbedder:
        settings = get_settings()
        jina_api_key = getattr(settings, "jina_api_key", None)
        if jina_api_key:
            return JinaSemanticEmbedder(
                api_key=jina_api_key,
                base_url=settings.jina_base_url,
                model=settings.jina_embedding_model,
                dimensions=settings.jina_embedding_dimensions,
            )
        return HashingSemanticEmbedder()

    def _extract_questions(self, message_text: str) -> list[str]:
        return [
            part.strip()
            for part in QUESTION_SPLIT_PATTERN.split(message_text.strip())
            if part.strip().endswith("?")
        ]

    def _extract_claims(self, message_text: str) -> list[str]:
        claims: list[str] = []
        for part in CLAIM_SPLIT_PATTERN.split(message_text.strip()):
            normalized = part.strip()
            if not normalized or normalized.endswith("?"):
                continue
            claims.append(normalized)
        return claims

    def _extract_assumptions(self, claims: list[str]) -> list[str]:
        return [claim for claim in claims if self._contains_any(claim, ASSUMPTION_CUES)]

    def _extract_contradictions(self, message_text: str) -> list[str]:
        parts = [part.strip() for part in CLAIM_SPLIT_PATTERN.split(message_text.strip()) if part.strip()]
        return [part for part in parts if self._contains_any(part, CONTRADICTION_CUES)]

    def _is_narrowing_question(self, question: str) -> bool:
        lowered = question.lower()
        return self._contains_any(lowered, NARROWING_CUES)

    def _is_generic_question(self, question: str) -> bool:
        lowered = question.lower()
        tokens = [token for token in re.findall(r"[a-z0-9]+", lowered) if token not in STOPWORDS]
        if not tokens:
            return True
        if any(token in DOMAIN_KEYWORDS for token in tokens):
            return False
        return len(tokens) <= 3

    def _detect_stagnation(self, state: ConversationState) -> tuple[bool, str | None]:
        last_three = state.information_gain_score_per_turn[-3:]
        if len(last_three) == 3 and all(score <= 0 for score in last_three):
            return True, "last_three_turns_low_information_gain"
        if state.redundant_question_count >= 2:
            return True, "redundant_question_threshold_reached"
        return False, None

    def _contains_any(self, text: str, cues: tuple[str, ...]) -> bool:
        lowered = text.lower()
        return any(cue in lowered for cue in cues)

    def _max_similarity(self, embedding: list[float], prior_embeddings: list[list[float]]) -> float | None:
        if not prior_embeddings:
            return None
        return max(self._cosine_similarity(embedding, other) for other in prior_embeddings)

    def _cosine_similarity(self, left: list[float], right: list[float]) -> float:
        if not left or not right:
            return 0.0
        limit = min(len(left), len(right))
        numerator = sum(left[index] * right[index] for index in range(limit))
        left_norm = math.sqrt(sum(value * value for value in left[:limit]))
        right_norm = math.sqrt(sum(value * value for value in right[:limit]))
        if left_norm == 0 or right_norm == 0:
            return 0.0
        return numerator / (left_norm * right_norm)
