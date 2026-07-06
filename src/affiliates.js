/* ── アフィリエイト設定 ──
   各サービスに登録後、発行されたIDを下の設定に貼り付けるだけで
   予約リンクが自動的にアフィリエイトリンクに切り替わります(未設定なら通常リンク)。

   - travelpayoutsMarker:
     Travelpayouts (https://www.travelpayouts.com/) に登録し、
     ダッシュボードに表示される「marker」(アフィリエイトID、数字列)を貼り付ける。
     設定すると Skyscanner のリンクが tp.media 経由の成果計測付きリンクになります。

   - bookingAid:
     Booking.com アフィリエイトパートナープログラム (https://www.booking.com/affiliate-program/)
     に登録し、発行される「aid」(パートナーID、数字列)を貼り付ける。
     設定すると Booking.com の検索URLに &aid= が付与されます。
*/
export const AFFILIATES = {
  travelpayoutsMarker: "", // 例: "123456"
  bookingAid: "",          // 例: "1234567"
};

/* 都市ごとの予約・情報サイトへのリンク一覧を返す */
export function linksFor(c) {
  const skyscannerBase = `https://www.skyscanner.jp/transport/flights/tyoa/${c.iata}/`;
  const skyscanner = AFFILIATES.travelpayoutsMarker
    ? `https://tp.media/r?marker=${AFFILIATES.travelpayoutsMarker}&p=4114&u=${encodeURIComponent(skyscannerBase)}`
    : skyscannerBase;

  let booking = `https://www.booking.com/searchresults.ja.html?ss=${encodeURIComponent(c.en)}`;
  if (AFFILIATES.bookingAid) booking += `&aid=${AFFILIATES.bookingAid}`;

  return [
    { label:"Google フライト", url:`https://www.google.com/travel/flights?q=${encodeURIComponent(`東京発 ${c.name} 行き 航空券`)}` },
    { label:"Skyscanner", url: skyscanner },
    { label:"Booking.com", url: booking },
    { label:"Tripadvisor", url:`https://www.tripadvisor.jp/Search?q=${encodeURIComponent(c.name)}` },
  ];
}
