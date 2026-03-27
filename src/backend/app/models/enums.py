"""Shared enum types for the agent platform."""

from enum import Enum


class RunStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    WAITING_FOR_APPROVAL = "waiting_for_approval"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class ApprovalStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    EXPIRED = "expired"


class ArtifactKind(str, Enum):
    IDEA_BRIEF = "idea_brief"
    RESEARCH_SUMMARY = "research_summary"
    ROADMAP = "roadmap"
    GENERIC = "generic"


class AgentKind(str, Enum):
    IDEATION = "ideation"
    VALUE_PROPOSITION = "value_proposition"
    RESEARCH = "research"
    ROADMAP = "roadmap"
    SUPERVISOR = "supervisor"
