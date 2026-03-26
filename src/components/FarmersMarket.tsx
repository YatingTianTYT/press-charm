"use client";

export default function FarmersMarket() {
  return (
    <div className="bg-[#C4896F] py-3 overflow-hidden">
      <div className="animate-ticker flex whitespace-nowrap">
        {[0, 1].map((i) => (
          <span
            key={i}
            className="font-script text-sm text-[#FAF7F2] mx-0 flex-shrink-0"
          >
            Find us this weekend &rarr; Sunday Farmers Market &middot; Saturday
            9am&ndash;2pm &#10022; Handmade with love &#10022;&nbsp;&nbsp;&nbsp;&nbsp;
            Find us this weekend &rarr; Sunday Farmers Market &middot; Saturday
            9am&ndash;2pm &#10022; Handmade with love &#10022;&nbsp;&nbsp;&nbsp;&nbsp;
            Find us this weekend &rarr; Sunday Farmers Market &middot; Saturday
            9am&ndash;2pm &#10022; Handmade with love &#10022;&nbsp;&nbsp;&nbsp;&nbsp;
          </span>
        ))}
      </div>
    </div>
  );
}
