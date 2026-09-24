# 癒sis HP 現状監査

監査日: 2026-09-24

## 既存URL

`index.html`、`about.html`、`menu.html`、`access.html`、`reserve.html`、`voice.html`、`staff.html`、`blog.html` と、既存ブログ4記事（`blog-eye-strain.html`、`blog-shoulder-stiffness.html`、`blog-sleep-insomnia.html`、`blog-cold-swelling.html`）が公開HTMLとして存在する。URLとslugは維持する。

## SEOメタデータ

- 既存HTMLはtitle、description、canonical、OGP URLを持つ。
- 既存ブログ4記事はBlogPosting JSON-LDを持つ。記事によって更新日表記がなく、記事一覧とデータの一元管理もない。
- OGP画像は既存の外部画像URLを使用している。新規生成記事では画像を設定しない。
- 全HTMLのH1は現状1件。

## 計測・店舗情報

- 全HTMLで確認できたGA4測定IDは `G-FC0KSLFKNN`。判断できない変更は行わない。
- 店名、住所、電話番号、豊津駅徒歩30秒、営業時間、Instagram、LINEは既存表記を基準にする。
- 既存の電話・LINE・Instagram・予約リンクは変更しない。

## ブログ構造

- `blog.html` の記事一覧は4件の手書きHTML。
- 既存記事は共通CSSを利用するが、記事本文・関連記事・メタ情報のテンプレートに差異がある。
- 既存記事の本文を今回無理に再生成せず、既存ファイルを保持する。メタデータは `data/blog-posts.json` で管理し、新規記事のみ共通テンプレートから生成する。

## サイトマップ・robots

- `sitemap.xml` は主要ページと既存4記事を含む。今回の生成スクリプトで主要ページを固定保持し、publishedデータから重複なく再構成する。
- `robots.txt` は既存内容を保持する。

## JavaScript・CSS

- `script.js` はナビゲーション開閉とスクロール表示を担当する。ブログ一覧はJavaScriptなしでもリンクをたどれるHTMLを生成する。
- `styles.css` にブログ一覧、記事本文、CTA用の再利用可能なクラスが既にあるため、新規テンプレートはこれを利用する。

## 実装方針とWARNING

- 既存4記事は公開資産として保持し、slug、本文、canonical、GA4、予約導線を変更しない。
- 新規記事は `status: published` のデータだけをHTML・一覧・sitemapへ反映する。今回、新規記事は公開追加しない。
- `blog-ideas.json` は企画台帳であり、HTMLを生成しない。
- 既存の健康表現には断定的な記述が一部残るため、既存本文を変更しない今回の範囲ではWARNINGとして扱う。新規テンプレートにはリラクゼーション表現と相談案内欄を用意する。
- 個人著者情報、創業理由、資格、地図座標など確認できない情報は追加しない。