from app.services.template_renderer import TemplateRenderer


def test_template_renderer_substitutes_known_placeholders():
    renderer = TemplateRenderer()

    rendered = renderer.render(
        "Founder message: {prompt}\nConstraints: {constraints_json}",
        {
            "prompt": "Review this strategy.",
            "constraints_json": '{"model":"helmos-default"}',
        },
    )

    assert rendered == 'Founder message: Review this strategy.\nConstraints: {"model":"helmos-default"}'


def test_template_renderer_leaves_json_braces_intact():
    renderer = TemplateRenderer()

    rendered = renderer.render(
        '{\n  "reply_to_user": {\n    "content": ""\n  }\n}',
        {},
    )

    assert rendered == '{\n  "reply_to_user": {\n    "content": ""\n  }\n}'
