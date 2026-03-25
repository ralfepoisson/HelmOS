"""OpenTelemetry integration points."""

import structlog


logger = structlog.get_logger(__name__)


class Telemetry:
    """Placeholder service-level telemetry wrapper."""

    def instrument_api_call(self, route_name: str) -> None:
        logger.info("api.instrumented", route=route_name)

    def instrument_workflow_node(self, node_name: str, run_id: str) -> None:
        logger.info("workflow.node.instrumented", node=node_name, run_id=run_id)
