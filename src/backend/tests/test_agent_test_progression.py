import pytest

from app.services.agent_test_progression import (
    AgentTestConversationProgressionService,
    ConversationState,
    HashingSemanticEmbedder,
)


@pytest.mark.asyncio
async def test_progression_service_flags_redundancy_and_stagnation():
    service = AgentTestConversationProgressionService(embedder=HashingSemanticEmbedder())
    state = ConversationState()

    first = await service.analyze_target_turn(
        state=state,
        turn_number=2,
        message_text="Can you tell me more about that?",
    )
    second = await service.analyze_target_turn(
        state=state,
        turn_number=4,
        message_text="Can you tell me more about that?",
    )
    third = await service.analyze_target_turn(
        state=state,
        turn_number=6,
        message_text="Can you tell me more about that?",
    )
    fourth = await service.analyze_target_turn(
        state=state,
        turn_number=8,
        message_text="Can you tell me more about that?",
    )

    assert first.redundant_question is False
    assert second.redundant_question is True
    assert third.stagnation_event is True
    assert fourth.low_exploration_depth_failure is True
    assert state.stagnation_cycles >= 2


@pytest.mark.asyncio
async def test_progression_service_requires_synthesis_checkpoint_every_five_agent_turns():
    service = AgentTestConversationProgressionService(embedder=HashingSemanticEmbedder())
    state = ConversationState(target_agent_turns=4)

    result = await service.analyze_target_turn(
        state=state,
        turn_number=10,
        message_text="What else do you know about the customer?",
    )

    assert result.synthesis_checkpoint_required is True
    assert result.synthesis_checkpoint_satisfied is False
    assert result.contradiction_checkpoint_satisfied is False
