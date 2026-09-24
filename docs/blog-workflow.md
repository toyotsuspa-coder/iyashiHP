# ブログ運用手順

## 公開記事を追加する

1. `data/blog-posts.json` に記事を1件追加する。
2. `status` を `draft` のまま本文と関連記事を確認する。
3. 公開準備ができたら `status` を `published` に変更する。
4. 次のコマンドを実行する。

```powershell
python tools/generate-blog.py
python tools/validate-blog.py
```

`published` の記事だけが新規HTML、`blog.html`、`sitemap.xml` に反映されます。`planned` と `draft` は公開されません。既存4記事は `sourceFile` を持つため、本文を再生成せず、slugと公開URLを保持します。

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