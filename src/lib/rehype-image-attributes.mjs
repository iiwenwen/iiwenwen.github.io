/**
 * Add safe defaults to Markdown images without requiring an image service or
 * downloading remote assets during the build.
 */
export default function rehypeImageAttributes() {
  return (tree) => {
    const visit = (node) => {
      if (node?.type === "element" && node.tagName === "img") {
        node.properties ??= {};
        node.properties.loading ??= "lazy";
        node.properties.decoding ??= "async";
      }

      if (Array.isArray(node?.children)) node.children.forEach(visit);
    };

    visit(tree);
  };
}
