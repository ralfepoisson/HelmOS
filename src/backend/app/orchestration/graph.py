"""LangGraph workflow assembly."""

from langgraph.graph import END, START, StateGraph

from app.orchestration.state import WorkflowState


class WorkflowGraphBuilder:
    """Compile the supervised orchestration graph."""

    def __init__(self, runtime):
        self.runtime = runtime

    def build(self):
        graph = StateGraph(WorkflowState)
        graph.add_node("supervisor", self.runtime.supervisor_node)
        graph.add_node("planner", self.runtime.planner_node)
        graph.add_node("deterministic", self.runtime.deterministic_node)
        graph.add_node("specialist", self.runtime.specialist_node)
        graph.add_node("workflow", self.runtime.multi_step_workflow_node)
        graph.add_node("policy", self.runtime.policy_node)
        graph.add_node("approval", self.runtime.approval_node)
        graph.add_node("finalize", self.runtime.finalize_node)

        graph.add_edge(START, "supervisor")
        graph.add_edge("supervisor", "planner")
        graph.add_conditional_edges(
            "planner",
            self.runtime.route_from_planner,
            {
                "deterministic": "deterministic",
                "agent": "specialist",
                "workflow": "workflow",
            },
        )
        graph.add_edge("deterministic", "policy")
        graph.add_edge("specialist", "policy")
        graph.add_edge("workflow", "policy")
        graph.add_conditional_edges(
            "policy",
            self.runtime.route_from_policy,
            {
                "approval": "approval",
                "finalize": "finalize",
            },
        )
        graph.add_edge("approval", END)
        graph.add_edge("finalize", END)
        return graph.compile()
