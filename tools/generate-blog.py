import html
import json
import re
from datetime import date
from pathlib import Path
from xml.etree.ElementTree import Element, SubElement, ElementTree

ROOT = Path(__file__).resolve().parents[1]
POSTS_FILE = ROOT / "data" / "blog-posts.json"
TEMPLATE_FILE = ROOT / "templates" / "blog-article.html"
BASE_URL = "https://toyotsuspa-coder.github.io/iyashiHP/"
MAIN_PAGES = ["", "about.html", "menu.html", "access.html", "reserve.html", "blog.html", "voice.html", "staff.html"]


def esc(value):
    return html.escape(str(value), quote=True)


def post_url(post):
    return post.get("sourceFile") or f"blog-{post['slug']}.html"


def load_posts():
    with POSTS_FILE.open(encoding="utf-8") as handle:
        posts = json.load(handle)
    return sorted((post for post in posts if post.get("status") == "published"), key=lambda post: post["datePublished"], reverse=True)


def load_all_posts():
    with POSTS_FILE.open(encoding="utf-8") as handle:
        return json.load(handle)


def render_sections(post):
    chunks = []
    for section in post.get("sections", []):
        chunks.append(f"<h2>{esc(section['heading'])}</h2>")
        for paragraph in section.get("paragraphs", []):
            safe_paragraph = esc(paragraph)
            safe_paragraph = safe_paragraph.replace("[[MENU_LINK]]", '<a href="menu.html">メニューページ</a>')
            safe_paragraph = safe_paragraph.replace("[[RESERVE_LINK]]", '<a href="reserve.html">予約ページ</a>')
            chunks.append(f"<p>{safe_paragraph}</p>")
    return "".join(chunks)


def render_faq(post):
    items = []
    for item in post.get("faq", []):
        items.append(f'<div class="faq-item"><h3>{esc(item["question"])}</h3><p>{esc(item["answer"])}</p></div>')
    return "".join(items)


def render_daily(post):
    items = post.get("dailyItems", [])
    if items:
        return "".join(f"<li>{esc(item)}</li>" for item in items)
    return f"<li>{esc(post.get('daily', ''))}</li>"


def render_related(post, by_id):
    items = []
    for related_id in post.get("relatedPosts", []):
        related = by_id.get(related_id)
        if related:
            items.append(f'<li><a href="{esc(post_url(related))}">{esc(related["title"])}</a></li>')
    return "".join(items)


def render_post(post, template, by_id):
    canonical = BASE_URL + post_url(post)
    jsonld = {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        "headline": post["title"],
        "description": post["description"],
        "datePublished": post["datePublished"],
        "dateModified": post["dateModified"],
        "author": {"@type": "Organization", "name": post["authorName"]},
        "publisher": {"@type": "Organization", "name": "ドライヘッドスパ専門店 癒sis", "url": BASE_URL},
        "mainEntityOfPage": canonical,
        "url": canonical,
    }
    replacements = {
        "title": esc(post["title"]), "description": esc(post["description"]), "canonical": canonical,
        "category": esc(post["category"]), "intro": esc(post["intro"]), "datePublished": esc(post["datePublished"]),
        "dateModified": esc(post["dateModified"]), "primaryIntent": esc(post["primaryIntent"]),
        "conclusion": esc(post.get("conclusion", post["intro"])), "sections": render_sections(post),
        "faq": render_faq(post),
        "perspective": esc(post.get("perspective", "癒sisでは、施術前にその日の過ごし方や気になる部位をうかがい、無理のないリラクゼーションの時間をご案内します。")),
        "daily": render_daily(post),
        "summary": esc(post.get("summary", "気になる状態に合わせて、休息と日常の過ごし方を見直すことから始めてみましょう。")),
        "authorName": esc(post["authorName"]), "related": render_related(post, by_id),
        "ctaHeading": esc(post.get("cta", {}).get("heading", "癒sisで休息の時間を作りませんか")),
        "ctaText": esc(post.get("cta", {}).get("text", "メニュー、予約方法、アクセスをご確認いただけます。")),
        "jsonld": json.dumps(jsonld, ensure_ascii=False),
    }
    for key, value in replacements.items():
        template = template.replace("{{ " + key + " }}", value)
    return template


def render_card(post, index):
    return f'''      <article class="post-card js-reveal" data-delay="{0.08 + index * 0.1:.2f}">
        <a class="post-link" href="{esc(post_url(post))}">
          <div class="post-meta"><time datetime="{esc(post['datePublished'])}">{esc(post['datePublished'].replace('-', '.'))}</time><span>{esc(post['category'])}</span></div>
          <h2>{esc(post['title'])}</h2><p>{esc(post['excerpt'])}</p><span class="btn btn-small">続きを読む <span class="read-more-arrow">→</span></span>
        </a>
      </article>'''


def update_blog_index(posts):
    path = ROOT / "blog.html"
    text = path.read_text(encoding="utf-8")
    cards = "\n".join(render_card(post, index) for index, post in enumerate(posts))
    start_marker = "    <!-- BLOG_POSTS_START -->"
    end_marker = "    <!-- BLOG_POSTS_END -->"
    if start_marker in text and end_marker in text:
        start = text.index(start_marker) + len(start_marker)
        end = text.index(end_marker, start)
        text = text[:start] + "\n" + cards + "\n" + text[end:]
    else:
        start = text.index('<div class="post-list">')
        end = text.index("\n    </div>\n  </div>\n</section>", start) + len("\n    </div>")
        replacement = f'<div class="post-list">\n{start_marker}\n{cards}\n{end_marker}\n    </div>'
        text = text[:start] + replacement + text[end:]
    path.write_text(text, encoding="utf-8", newline="\n")


def update_sitemap(posts):
    root = Element("urlset", {"xmlns": "http://www.sitemaps.org/schemas/sitemap/0.9"})
    entries = []
    for page in MAIN_PAGES:
        entries.append((BASE_URL + page, ""))
    for post in posts:
        entries.append((BASE_URL + post_url(post), post["dateModified"]))
    seen = set()
    for loc, lastmod in entries:
        if loc in seen:
            continue
        seen.add(loc)
        item = SubElement(root, "url")
        SubElement(item, "loc").text = loc
        if lastmod:
            SubElement(item, "lastmod").text = lastmod
    ElementTree(root).write(ROOT / "sitemap.xml", encoding="utf-8", xml_declaration=True)


def main():
    all_posts = load_all_posts()
    posts = sorted((post for post in all_posts if post.get("status") == "published"), key=lambda post: post["datePublished"], reverse=True)
    previews = [post for post in all_posts if post.get("status") == "draft"]
    by_id = {post["id"]: post for post in all_posts}
    template = TEMPLATE_FILE.read_text(encoding="utf-8")
    for post in posts + previews:
        if not post.get("sourceFile"):
            (ROOT / post_url(post)).write_text(render_post(post, template, by_id), encoding="utf-8", newline="\n")
    update_blog_index(posts)
    update_sitemap(posts)
    print(f"Generated {sum(not post.get('sourceFile') for post in posts)} article(s) and {len(previews)} draft preview(s); {len(posts)} published article(s) indexed.")


if __name__ == "__main__":
    main()