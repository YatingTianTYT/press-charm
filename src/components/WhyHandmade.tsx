export default function WhyHandmade() {
  return (
    <section className="bg-[#F0E8DF] py-16 md:py-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-8">
          {/* Hand-Painted */}
          <div className="flex flex-col items-center text-center">
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#C4896F"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mb-4"
            >
              <path d="M18.37 2.63a1 1 0 0 1 1.41 0l1.59 1.59a1 1 0 0 1 0 1.41l-9.2 9.2a2 2 0 0 1-1.02.54l-3.54.89a.5.5 0 0 1-.6-.6l.89-3.54a2 2 0 0 1 .54-1.02l9.93-8.47Z" />
              <path d="M2 22h4" />
              <path d="M6 22v-4c0-1.1.9-2 2-2h0" />
            </svg>
            <h3 className="font-heading text-lg text-[#2C1810] mb-2">
              Hand-Painted
            </h3>
            <p className="text-sm text-[#8B6F5E] font-light leading-relaxed max-w-xs">
              Every set is a tiny canvas, painted with care and intention.
            </p>
          </div>

          {/* Custom Fit */}
          <div className="flex flex-col items-center text-center">
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#C4896F"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mb-4"
            >
              <path d="M2 4h20" />
              <path d="M4 2v4" />
              <path d="M20 2v4" />
              <path d="M12 2v4" />
              <path d="M8 2v2" />
              <path d="M16 2v2" />
              <path d="M2 12h4" />
              <path d="M18 12h4" />
              <path d="M12 8v8" />
              <path d="M8 10v4" />
              <path d="M16 10v4" />
            </svg>
            <h3 className="font-heading text-lg text-[#2C1810] mb-2">
              Custom Fit
            </h3>
            <p className="text-sm text-[#8B6F5E] font-light leading-relaxed max-w-xs">
              Sized to your fingers. Because one size never fits all.
            </p>
          </div>

          {/* Market Fresh */}
          <div className="flex flex-col items-center text-center">
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#C4896F"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mb-4"
            >
              <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10" />
              <path d="M12 2c2 2.5 3 5.5 3 10" />
              <path d="M12 2c-2 2.5-3 5.5-3 10s1 7.5 3 10" />
              <path d="M17 17l3 3" />
              <path d="M20 17l-3 3" />
              <path d="M15 12c0 4.5 1 7.5 3 10" />
            </svg>
            <h3 className="font-heading text-lg text-[#2C1810] mb-2">
              Market Fresh
            </h3>
            <p className="text-sm text-[#8B6F5E] font-light leading-relaxed max-w-xs">
              Find us at local farmers markets, bringing nails to the people.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
