// Architecture warnings for a blueprint, recalculated on every edit. Pure and free:
// no AI involved. Returns [{ key, message }].
export function lintBlueprint(blueprint, playbook) {
  const warnings = [];
  const warn = (key, message) => warnings.push({ key, message });

  const maxProps = playbook?.maxProps ?? 5;
  const componentNames = blueprint.components.map((c) => c.name.trim());

  // Duplicate names (pages and components share one namespace)
  const allNames = [...blueprint.pages.map((p) => p.name.trim()), ...componentNames].filter(Boolean);
  for (const name of new Set(allNames.filter((name, index) => allNames.indexOf(name) !== index))) {
    warn(`duplicate-${name}`, `"${name}" is used more than once. Page and component names must be unique.`);
  }

  // Duplicate routes
  const routes = blueprint.pages.map((p) => p.route.trim());
  for (const route of new Set(routes.filter((route, index) => routes.indexOf(route) !== index))) {
    warn(`route-${route}`, `Two pages share the route "${route}".`);
  }

  if (!routes.includes("/")) warn("no-home", 'No page has the route "/", so the app has no start page.');

  // Too many props
  for (const component of blueprint.components) {
    if (component.props.length > maxProps) {
      warn(
        `props-${component.name}`,
        `${component.name} takes ${component.props.length} props (limit ${maxProps}). Group related props or split the component.`
      );
    }
  }

  // Components nothing uses
  const usedNames = new Set([...blueprint.pages, ...blueprint.components].flatMap((item) => item.uses));
  for (const name of componentNames) {
    if (name && !usedNames.has(name)) warn(`unused-${name}`, `${name} isn't used by any page or component.`);
  }

  // Pages that use no components
  for (const page of blueprint.pages) {
    if (!page.uses.length) warn(`empty-${page.name}`, `Page ${page.name} doesn't use any components.`);
  }

  // Components that use themselves
  for (const component of blueprint.components) {
    if (component.uses.includes(component.name)) warn(`self-${component.name}`, `${component.name} uses itself.`);
  }

  return warnings;
}
