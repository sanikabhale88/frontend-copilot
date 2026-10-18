// Pure helpers that turn flat file paths into a nested folder/file tree.
//
// Node shapes (path is the unique id):
//   { type: "folder", name: "pages", path: "src/pages", children: [...] }
//   { type: "file", name: "Home.jsx", path: "src/pages/Home.jsx" }
// File nodes never hold code — project.files stays the single source of truth.

export function buildFileTree(paths) {
  const root = { children: [] };

  for (const path of paths) {
    const parts = path.split("/");
    let current = root;

    parts.forEach((part, index) => {
      const nodePath = parts.slice(0, index + 1).join("/");

      // Last segment is the file itself
      if (index === parts.length - 1) {
        current.children.push({ type: "file", name: part, path: nodePath });
        return;
      }

      // Find or create the folder for this segment, then walk into it
      let folder = current.children.find(
        (child) => child.type === "folder" && child.name === part
      );

      if (!folder) {
        folder = { type: "folder", name: part, path: nodePath, children: [] };
        current.children.push(folder);
      }

      current = folder;
    });
  }

  return sortNodes(root.children);
}

// Folders first, then A→Z; recurses into every folder.
function sortNodes(nodes) {
  return [...nodes]
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
      return a.name.localeCompare(b.name);
    })
    .map((node) =>
      node.type === "folder"
        ? { ...node, children: sortNodes(node.children) }
        : node
    );
}

// Every folder path in the tree, e.g. ["src", "src/components", "src/pages"].
export function getFolderPaths(nodes) {
  return nodes.flatMap((node) =>
    node.type === "folder" ? [node.path, ...getFolderPaths(node.children)] : []
  );
}

// "src/pages/Home.jsx" → ["src", "src/pages"]
export function getParentFolders(path) {
  const folders = path.split("/").slice(0, -1);
  return folders.map((_, index) => folders.slice(0, index + 1).join("/"));
}
