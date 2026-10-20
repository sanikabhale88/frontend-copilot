/* global axe */

// Runs INSIDE a hidden audit iframe, after runProject has rendered the component:
// checks horizontal overflow, small tap targets and (optionally) accessibility with
// axe-core, then posts { type: "audit", width, ... } to the parent app.
//
// Must stay self-contained (no imports, no outside variables): its source text is
// injected into the iframe with .toString(), like runProject.
export function runAudit(width, withAxe) {
  const report = (payload) => {
    window.parent.postMessage({ source: "project-preview", type: "audit", width, ...payload }, "*");
  };

  // Short description of an element for issue lists and fix prompts
  const describe = (el) => {
    const classes = (el.getAttribute("class") || "").trim().split(/\s+/).slice(0, 6).join(" ");
    const text = (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 40);
    return `<${el.tagName.toLowerCase()}${classes ? ` class="${classes}"` : ""}>${text ? ` "${text}"` : ""}`;
  };

  // Inside a scroll container, sticking out is intended
  const insideScroller = (el, root) => {
    for (let node = el.parentElement; node && node !== root.parentElement; node = node.parentElement) {
      if (["auto", "scroll", "hidden", "clip"].includes(getComputedStyle(node).overflowX)) return true;
    }
    return false;
  };

  function checkOverflow(root) {
    const viewport = document.documentElement.clientWidth;
    const pageWidth = document.documentElement.scrollWidth;
    if (pageWidth <= viewport + 1) return null;

    const offenders = new Set(
      [...root.querySelectorAll("*")].filter(
        (el) => el.getBoundingClientRect().right > viewport + 1 && !insideScroller(el, root)
      )
    );

    // The outermost elements that stick out are the ones to fix
    const culprits = [...offenders].filter((el) => !offenders.has(el.parentElement));

    return {
      pageWidth,
      viewport,
      elements: culprits.slice(0, 3).map((el) => ({
        html: describe(el),
        width: Math.round(el.getBoundingClientRect().width),
      })),
    };
  }

  // WCAG 2.5.8 (AA): targets at least 24×24px. Inline text links are exempt, and so
  // are checkboxes/radios with a label (the label is the target).
  function checkTapTargets(root) {
    const candidates = root.querySelectorAll(
      'a[href], button, input:not([type="hidden"]), select, textarea, [role="button"]'
    );

    const small = [...candidates].filter((el) => {
      const rect = el.getBoundingClientRect();
      if (!rect.width || !rect.height) return false;
      if (rect.width >= 24 && rect.height >= 24) return false;
      if (el.tagName === "A" && getComputedStyle(el).display === "inline") return false;
      if (["checkbox", "radio"].includes(el.type) && el.labels?.length) return false;
      return true;
    });

    return {
      count: small.length,
      examples: small.slice(0, 3).map((el) => {
        const rect = el.getBoundingClientRect();
        return `${describe(el)} is ${Math.round(rect.width)}×${Math.round(rect.height)}px`;
      }),
    };
  }

  async function checkAccessibility(root) {
    if (typeof axe === "undefined") return { error: "The accessibility checker (axe-core) could not be loaded." };

    const results = await axe.run(root, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
      resultTypes: ["violations"],
    });

    return {
      violations: results.violations.map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        help: violation.help,
        count: violation.nodes.length,
        example: (violation.nodes[0]?.html || "").slice(0, 160),
      })),
    };
  }

  // Give React effects and the Tailwind CDN (which generates styles asynchronously)
  // time to settle before measuring
  setTimeout(async () => {
    try {
      const root = document.getElementById("root");

      // Nothing rendered: the preview failed, which the live preview already reports
      if (!root || !root.childElementCount) {
        report({ skipped: true });
        return;
      }

      report({
        overflow: checkOverflow(root),
        smallTargets: width <= 480 ? checkTapTargets(root) : null,
        a11y: withAxe ? await checkAccessibility(root) : null,
      });
    } catch (error) {
      report({ error: error.message });
    }
  }, 1200);
}
