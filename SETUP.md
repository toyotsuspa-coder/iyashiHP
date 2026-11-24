# 癒sis予約システム 本番設定

この設定はSquare本番APIを利用します。ID・APIバージョン・Worker URLは確認済みの実値に置き換えてください。Square Access TokenはWorker Secretとして登録し、HTMLやJavaScriptに書かないでください。

## 1. Square Developer Dashboardで確認

1. [Square Developer Dashboard](https://developer.squareup.com/apps)で本番アプリを開きます。
2. 実際に予約を受ける本番Locationの**Location ID**を確認します。
3. 本番Catalogで対象コースのService Variation IDが`KNRVRECUKLIACVTRGYYYDC4X`であることを確認します。
4. Catalogの名称、金額（8,200円）、施術時間（80分）、予約枠（1時間50分）、スタッフの勤務時間・予約可能時間を確認します。
5. 本番 Access Tokenを発行します。ブラウザやGitHubには保存しません。
6. Square APIバージョンはDeveloper Dashboardや公式APIリファレンスで現行値を確認し、明示的に設定します。

## 2. Cloudflare Workerの設定

リポジトリのルートから実行します。

```powershell
npx wrangler login
npx wrangler deploy --config workers/iyasis-booking-api/wrangler.toml
```

`wrangler.toml`のプレースホルダーを本番の実値へ変更します。API接続先は本番URLを維持します。

```toml
[vars]
ALLOWED_ORIGIN = "https://toyotsuspa-coder.github.io"
LOCATION_ID = "LG53TFRM3KHG9"
FOOT80_VARIATION_ID = "KNRVRECUKLIACVTRGYYYDC4X"
SQUARE_API_VERSION = "Developer Dashboardで確認したSquare APIバージョン"
SQUARE_API_BASE_URL = "https://connect.squareup.com"
```

Access TokenをCloudflare Secretへ登録します。

```powershell
npx wrangler secret put SQUARE_ACCESS_TOKEN --config workers/iyasis-booking-api/wrangler.toml
```

TEAM_MEMBER_IDを固定する場合だけ、任意で設定します。空いているスタッフなら誰でもよい場合は設定しません。

```toml
TEAM_MEMBER_ID = "実際のSandbox Team Member ID"
```

任意で二重送信とレート制限用KVを設定します。

```powershell
npx wrangler kv namespace create BOOKING_KV
npx wrangler kv namespace create RATE_LIMIT_KV
```

作成されたnamespace IDを`wrangler.toml`へbindingとして追加します。

```toml
[[kv_namespaces]]
binding = "BOOKING_KV"
id = "実際のnamespace ID"

[[kv_namespaces]]
binding = "RATE_LIMIT_KV"
id = "実際のnamespace ID"
```

ローカル起動でも設定した環境（本番またはSandbox）へSquare APIを呼び出します。予約テストは実予約になるため、環境を取り違えないでください。`.dev.vars`はGit追跡対象外です。

```text
SQUARE_ACCESS_TOKEN=YOUR_ACCESS_TOKEN
LOCATION_ID=LG53TFRM3KHG9
FOOT80_VARIATION_ID=KNRVRECUKLIACVTRGYYYDC4X
SQUARE_API_VERSION=YOUR_SQUARE_API_VERSION
SQUARE_API_BASE_URL=https://connect.squareup.com
```

ローカル起動は次のとおりです。

```powershell
npx wrangler dev --config workers/iyasis-booking-api/wrangler.toml
```

## 3. フロント設定

デプロイ後のWorker URLを`booking.js`の先頭で設定します。

```javascript
var API_BASE = 'https://あなたのWorker名.あなたのサブドメイン.workers.dev';
```

`ALLOWED_ORIGIN`はGitHub Pages本番のみ許可されます。公開予約を開始する前に、本番の設定値とSquareカレンダーの予約受付設定を必ず照合してください。

## 4. 本番接続確認手順

1. Workerをデプロイします。
2. ブラウザで予約ページを開きます。
3. 対象コースの名称・金額・施術時間と予約枠が意図した値になっていることを確認します。
4. 日付を選び、Square本番Availability APIの実空き枠だけ表示されることを確認します。
5. 予約テスト前に、店舗内で合意した確認用日時と顧客情報を使用してください。実予約になるため、確認後はSquareカレンダーで予約・顧客情報を確認し、必要な後処理を行います。
6. Square本番Bookingsカレンダーに予約が作成されることを確認します。
7. ブラウザのDevToolsでSquare Access Tokenや個人情報がGA4イベントに含まれないことを確認します。
8. GA4の`booking_complete`がSquare予約成功後だけ記録されることを確認します。

## 設定値の場所

- Worker URL: `booking.js`冒頭の`API_BASE`
- Square API接続先、Location ID、対象コースのService Variation ID、APIバージョン: `workers/iyasis-booking-api/wrangler.toml`
- Square Access Token: Cloudflare Worker Secret `SQUARE_ACCESS_TOKEN`のみ
- Worker未設定時の直接予約URL: `booking.js`冒頭の`SQUARE_BOOKING_URL`

このWorkerは本番APIを初期値とします。Sandboxでの試験が必要な場合のみ、Sandbox用のLocation・Catalog・Token一式を用意したうえで、`SQUARE_API_BASE_URL`を`https://connect.squareupsandbox.com`へ切り替え、本番Tokenと混在させないでください。提示された予約URLへ直接進むフォールバックもあります。直接遷移した予約の成否はこのサイト側では検知せず、`booking_complete`も送信しません。
