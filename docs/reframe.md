# Reframe

Reframe is an optional skill for planning and applying user-interface changes with your coding agent. It is separate from OpenWolf's automatic memory and context work.

The bundled skill contains UI framework profiles and prompts. Your agent uses them with the project map to review the current stack, compare options or plan a migration. The profiles are reference material; the agent should verify current framework documentation before changing dependencies.

## Use the skill

Where your agent supports the installed skill commands:

```text
/reframe migrate
/reframe audit
/reframe fix
```

You can also ask the agent to use the Reframe skill in a normal prompt.

For a migration, state the current framework, target requirements and parts of the interface that must keep working. The agent can then propose a framework and implementation steps. Review dependency changes, routing, styling, accessibility and the build result.

For an audit, name the page or component and the problem you want to solve. Useful criteria include text readability, layout, keyboard access, responsive behaviour and consistency. A fix should address those criteria in the existing project.

## Example request

> Use Reframe to review the account settings page. Keep the current framework. Improve the form layout and keyboard access, then check the mobile view and build.

The skill guides your coding agent. It does not guarantee design quality or accessibility. Using it can consume the agent's normal model usage and may change project files or dependencies.
