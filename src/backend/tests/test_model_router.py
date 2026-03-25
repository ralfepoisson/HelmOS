from app.services.model_router import ModelRouter


def test_model_router_uses_litellm_research_alias():
    router = ModelRouter(default_model="helmos-default", supervisor_model="helmos-supervisor")

    assert router.for_agent("research") == "helmos-research"
    assert router.for_agent("ideation") == "helmos-default"
