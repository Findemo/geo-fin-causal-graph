export async function loadBundle() {
  const res = await fetch(new URL("../data/bundle.json", import.meta.url));
  if (!res.ok) {
    throw new Error(`加载 bundle.json 失败: ${res.status}`);
  }
  return res.json();
}

