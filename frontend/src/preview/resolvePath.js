// Resolves an import request to a file path in the project.
//   resolvePath("src/pages/Projects.jsx", "../components/ProjectCard", files)
//     → "src/components/ProjectCard.jsx"
// Bare package names ("react") are returned unchanged; a missing file returns null.
//
// Must stay self-contained (no imports, no outside variables): its source text is
// injected into the preview iframe with .toString().
export function resolvePath(fromFile, request, files) {
  if (!request.startsWith("./") && !request.startsWith("../")) {
    return request;
  }

  // Start from the importing file's folder and apply each segment
  const parts = fromFile.split("/").slice(0, -1);

  for (const segment of request.split("/")) {
    if (segment === "" || segment === ".") continue;

    if (segment === "..") {
      parts.pop();
    } else {
      parts.push(segment);
    }
  }

  const base = parts.join("/");
  const candidates = [
    base,
    base + ".jsx",
    base + ".js",
    base + "/index.jsx",
    base + "/index.js",
  ];

  for (const candidate of candidates) {
    if (Object.prototype.hasOwnProperty.call(files, candidate)) {
      return candidate;
    }
  }

  return null;
}
