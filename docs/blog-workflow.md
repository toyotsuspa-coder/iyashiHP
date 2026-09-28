# ブログ運用手順

## 記事を投稿する

1. `data/blog-posts.json` に記事を1件追加し、通常は `status` を `published` にする。
2. 記事内容、関連記事、表現ルール、医療機関への案内を確認する。
3. 次のコマンドを実行する。

```powershell
python tools/generate-blog.py
python tools/validate-blog.py
```

検証に通ったら、変更をコミットして `main` へ push します。GitHub Pagesへの反映を確認します。通常投稿で公開確認を待つ工程は設けません。

`published` の記事だけが新規HTML、`blog.html`、`sitemap.xml` に反映されます。公開保留を明示された記事だけ `draft` にし、`planned` と `draft` は一覧とsitemapに含めません。既存4記事は `sourceFile` を持つため、本文を再生成せず、slugと公開URLを保持します。

## 記事データの書き方

新規記事では `id`、`slug`、`title`、`description`、`category`、`primaryIntent`、`datePublished`、`dateModified`、`authorName`、`excerpt`、`intro`、`sections`、`relatedPosts`、`cta`、`status` を入力します。`sections` は次の形式です。

```json
{
  "heading": "見出し",
  "paragraphs": ["本文の段落1", "本文の段落2"]
}
```

医療行為や効果を断定せず、強い症状や長引く症状がある場合は医療機関への相談を案内してください。画像は実在確認できた場合だけデータへ追加します。

## 企画を管理する

公開前の候補は `data/blog-ideas.json` に登録します。企画には検索意図と差別化方針を必ず記載し、企画を追加しただけではHTMLを生成しません。

## 生成物の確認

生成後は、既存4記事のファイルが意図せず書き換わっていないこと、予約・電話・LINE・Instagramのリンクが維持されていること、sitemapのURLと一覧件数が一致することを確認してから公開します。