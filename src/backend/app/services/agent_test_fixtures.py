"""Fixture loading and parsing for agent testing."""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path


@dataclass(slots=True)
class FixtureRevealableFact:
    fact_id: str
    content: str
    reveal_conditions: list[str] = field(default_factory=list)
    must_not_be_disclosed_before_turn: int = 1


@dataclass(slots=True)
class AgentTestFixture:
    fixture_key: str
    fixture_version: str
    fixture_class: str
    title: str
    applicable_agents: list[str]
    rubric_version_hint: str
    driver_version_hint: str
    min_turns: int
    max_turns: int
    scenario_dimensions: list[str]
    primary_goal: str
    raw_markdown: str
    path: str
    sections: dict[str, str]
    revealable_facts: list[FixtureRevealableFact]
    blocked_facts: list[str]


def _repo_root() -> Path:
    current = Path(__file__).resolve()
    for parent in current.parents:
        if (parent / "docs").exists():
            return parent
    raise RuntimeError("Could not locate repository root from service path.")


def _fixtures_root() -> Path:
    return _repo_root() / "docs" / "agent_test_fixtures"


def _parse_scalar(value: str):
    text = value.strip()
    if text.isdigit():
        return int(text)
    if text.lower() in {"true", "false"}:
        return text.lower() == "true"
    return text


def _parse_frontmatter(raw: str) -> tuple[dict, str]:
    if not raw.startswith("---\n"):
        raise ValueError("Fixture markdown must start with frontmatter.")

    _, rest = raw.split("---\n", 1)
    frontmatter_text, body = rest.split("\n---\n", 1)
    data: dict[str, object] = {}
    current_list_key: str | None = None

    for raw_line in frontmatter_text.splitlines():
        line = raw_line.rstrip()
        if not line:
            continue
        stripped = line.strip()
        if stripped.startswith("- "):
            if not current_list_key:
                raise ValueError(f"Unexpected list item in frontmatter: {line}")
            value = stripped[2:].strip()
            existing = data.setdefault(current_list_key, [])
            if not isinstance(existing, list):
                raise ValueError(f"Frontmatter key '{current_list_key}' is not a list.")
            existing.append(_parse_scalar(value))
            continue
        if ":" not in line:
            raise ValueError(f"Invalid frontmatter line: {line}")
        key, value = line.split(":", 1)
        key = key.strip()
        value = value.strip()
        if value:
            data[key] = _parse_scalar(value)
            current_list_key = None
        else:
            data[key] = []
            current_list_key = key

    return data, body.strip()


def _parse_sections(body: str) -> dict[str, str]:
    sections: dict[str, list[str]] = {}
    current_heading: str | None = None
    for line in body.splitlines():
        if line.startswith("## "):
            current_heading = line[3:].strip()
            sections[current_heading] = []
            continue
        if current_heading:
            sections[current_heading].append(line)
    return {heading: "\n".join(lines).strip() for heading, lines in sections.items()}


def _parse_revealable_facts(section_text: str) -> list[FixtureRevealableFact]:
    facts: list[FixtureRevealableFact] = []
    if not section_text:
        return facts

    blocks = [block.strip() for block in section_text.split("### ") if block.strip()]
    for block in blocks:
        lines = block.splitlines()
        header = lines[0].strip()
        if not header.startswith("fact_id:"):
            continue
        fact_id = header.split(":", 1)[1].strip()
        content = ""
        reveal_conditions: list[str] = []
        min_turn = 1
        in_conditions = False
        for raw_line in lines[1:]:
            line = raw_line.strip()
            if line.startswith("- content:"):
                content = line.split(":", 1)[1].strip().strip('"')
                in_conditions = False
            elif line.startswith("- reveal_conditions:"):
                in_conditions = True
            elif in_conditions and line.startswith("- "):
                reveal_conditions.append(line[2:].strip())
            elif line.startswith("- must_not_be_disclosed_before_turn:"):
                min_turn = int(line.split(":", 1)[1].strip())
                in_conditions = False
            elif in_conditions and line:
                reveal_conditions.append(line.strip("- ").strip())
        facts.append(
            FixtureRevealableFact(
                fact_id=fact_id,
                content=content,
                reveal_conditions=reveal_conditions,
                must_not_be_disclosed_before_turn=min_turn,
            )
        )
    return facts


def _parse_bullets(section_text: str) -> list[str]:
    items: list[str] = []
    for line in section_text.splitlines():
        stripped = line.strip()
        if stripped.startswith("- "):
            items.append(stripped[2:].strip())
    return items


class AgentTestFixtureRepository:
    """Filesystem-backed fixture registry."""

    def __init__(self, root: Path | None = None):
        self.root = root or _fixtures_root()

    def list_fixtures(self) -> list[AgentTestFixture]:
        fixtures: list[AgentTestFixture] = []
        for path in sorted(self.root.rglob("*.md")):
            fixtures.append(self.load_fixture_from_path(path))
        return fixtures

    def load_fixture(self, fixture_key: str, fixture_version: str | None = None) -> AgentTestFixture:
        for fixture in self.list_fixtures():
            if fixture.fixture_key != fixture_key:
                continue
            if fixture_version and fixture.fixture_version != fixture_version:
                continue
            return fixture
        raise LookupError(f"Fixture '{fixture_key}' was not found.")

    def load_fixture_from_path(self, path: Path) -> AgentTestFixture:
        raw = path.read_text(encoding="utf-8")
        frontmatter, body = _parse_frontmatter(raw)
        sections = _parse_sections(body)
        return AgentTestFixture(
            fixture_key=str(frontmatter["fixture_key"]),
            fixture_version=str(frontmatter["fixture_version"]),
            fixture_class=str(frontmatter["fixture_class"]),
            title=str(frontmatter["title"]),
            applicable_agents=[str(item) for item in frontmatter.get("applicable_agents", [])],
            rubric_version_hint=str(frontmatter["rubric_version_hint"]),
            driver_version_hint=str(frontmatter["driver_version_hint"]),
            min_turns=int(frontmatter.get("min_turns", 20)),
            max_turns=int(frontmatter.get("max_turns", 30)),
            scenario_dimensions=[str(item) for item in frontmatter.get("scenario_dimensions", [])],
            primary_goal=str(frontmatter.get("primary_goal", "")),
            raw_markdown=raw,
            path=str(path.relative_to(_repo_root())),
            sections=sections,
            revealable_facts=_parse_revealable_facts(sections.get("Revealable Facts", "")),
            blocked_facts=_parse_bullets(sections.get("Blocked Facts", "")),
        )
