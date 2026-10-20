// Resolves an import request to a file path in a generated project.
//   resolvePath("src/pages/Projects.jsx", "../components/ProjectCard", files)
//     → "src/components/ProjectCard.jsx"
// Bare package names ("react") are returned unchanged; a missing file returns null.
//
// Same logic as frontend/src/preview/resolvePath.js (which runs inside the preview
// iframe); copied because the backend is deployed on its own.
function resolvePath(fromFile, request, files) {
  if (!request.startsWith("./") && !request.startsWith("../")) {
    return request;
  }

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
  const candidates = [base, base + ".jsx", base + ".js", base + "/index.jsx", base + "/index.js"];

  for (const candidate of candidates) {
    if (Object.prototype.hasOwnProperty.call(files, candidate)) {
      return candidate;
    }
  }

  return null;
}

module.exports = { resolvePath };
