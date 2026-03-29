from app.repositories.registry_repository import build_prompt_key_prefixes


def test_build_prompt_key_prefixes_supports_legacy_agent_suffix():
    assert build_prompt_key_prefixes("testing") == ["testing.", "testing-agent."]
    assert build_prompt_key_prefixes("value-proposition") == [
        "value-proposition.",
        "value-proposition-agent.",
    ]


def test_build_prompt_key_prefixes_ignores_blank_agent_keys():
    assert build_prompt_key_prefixes("   ") == []
