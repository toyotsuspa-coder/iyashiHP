import json
import re
import sys
from collections import Counter
from pathlib import Path
from xml.etree import ElementTree

ROOT = Path(__file__).resolve().parents[1]
BASE_URL = "https://toyotsuspa-coder.github.io/iyashiHP/"
errors = []
warnings = []


def duplicates(values, label):
    for value, count in Counter(values).items():
        if value and count > 1:
            errors.append(f"{label} duplicate: {value}")


def main():
    posts = json.loads((ROOT / "data" / "blog-posts.json").read_text(encoding="utf-8"))
    ideas = json.loads((ROOT / "data" / "blog-ideas.json").read_text(encoding="utf-8"))
    published = [post for post in posts if post.get("status") == "published"]
    duplicates([post.get("id") for post in posts], "id")
    duplicates([post.get("slug") for post in posts], "slug")
    duplicates([post.get("title") for post in posts], "title")
    duplicates([post.get("description") for post in posts], "description")
    duplicates([post.get("primaryIntent") for post in posts], "primaryIntent")
    duplicates([idea.get("targetQuery") for idea in ideas], "targetQuery")
    required = ["id", "slug", "title", "description", "category", "primaryIntent", "datePublished", "dateModified", "authorName", "excerpt", "intro", "relatedPosts", "cta", "status"]
    by_id = {post.get("id"): post for post in posts}
    for post in published:
        for field in required:
            if not post.get(field) and post.get(field) != []:
                errors.append(f"published {post.get('id')}: missing {field}")
        if post["dateModified"] < post["datePublished"]:
            errors.append(f"{post['id']}: dateModified is before datePublished")
        if not post.get("sourceFile") and not post.get("sections"):
            errors.append(f"{post['id']}: generated article needs sections")
        for related in post.get("relatedPosts", []):
            if related not in by_id:
                errors.append(f"{post['id']}: related post does not exist: {related}")
    intents = Counter(post.get("primaryIntent") for post in published)
    for intent, count in intents.items():
        if count > 1:
            warnings.append(f"published primaryIntent repeated: {intent}")
    for first_index, first in enumerate(published):
        for second in published[first_index + 1:]:
            if first["title"] in second["title"] or second["title"] in first["title"]:
                warnings.append(f"similar titles: {first['id']} / {second['id']}")

    html_files = list(ROOT.glob("*.html"))
    local_targets = set(path.name for path in ROOT.iterdir() if path.is_file())
    for path in html_files:
        text = path.read_text(encoding="utf-8")
        for label, pattern in [("title", r"<title>[^<]+</title>"), ("description", r'<meta name="description"'), ("canonical", r'<link rel="canonical"'), ("og:url", r'<meta property="og:url"')]:
            if not re.search(pattern, text, re.I):
                errors.append(f"{path.name}: missing {label}")
        h1_count = len(re.findall(r"<h1\b", text, re.I))
        if h1_count != 1:
            errors.append(f"{path.name}: expected one h1, found {h1_count}")
        for href in re.findall(r'href=["\']([^"\']+)', text, re.I):
            if href.startswith(("http:", "https:", "tel:", "mailto:", "#", "data:")):
                continue
            target = href.split("#", 1)[0].split("?", 1)[0]
            if target and target not in local_targets:
                errors.append(f"{path.name}: broken local link {href}")

    sitemap = ROOT / "sitemap.xml"
    try:
        tree = ElementTree.parse(sitemap)
        urls = [child.text for node in tree.getroot() if node.tag.endswith("url") for child in node if child.tag.endswith("loc")]
        duplicates(urls, "sitemap URL")
        expected = {BASE_URL + (post.get("sourceFile") or f"blog-{post['slug']}.html") for post in published}
        actual = set(urls)
        if expected - actual:
            errors.append(f"sitemap missing published URLs: {sorted(expected - actual)}")
    except ElementTree.ParseError as exc:
        errors.append(f"sitemap XML parse: {exc}")

    blog_text = (ROOT / "blog.html").read_text(encoding="utf-8")
    listed = set(re.findall(r'<a class="post-link" href="([^"]+)', blog_text))
    expected_files = {post.get("sourceFile") or f"blog-{post['slug']}.html" for post in published}
    if listed != expected_files:
        errors.append(f"blog.html published links mismatch: expected {len(expected_files)}, found {len(listed)}")

    for warning in warnings:
        print(f"WARNING: {warning}")
    for error in errors:
        print(f"ERROR: {error}")
    print(f"Checked {len(html_files)} HTML files, {len(published)} published posts, {len(ideas)} ideas.")
    if errors:
        sys.exit(1)


if __name__ == "__main__":
    main()