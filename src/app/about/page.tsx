export default function AboutPage() {
  return (
    <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
      {/* Heading */}
      <div className="text-center mb-14">
        <h1 className="font-heading text-2xl md:text-3xl font-extralight tracking-[0.1em] uppercase text-[#2C1810]">
          About Press Charm
        </h1>
        <p className="mt-3 text-sm font-light text-[#8B6F5E] tracking-wide">
          Our story, our passion
        </p>
      </div>

      {/* Content */}
      <div className="space-y-8 text-sm font-light leading-relaxed text-[#8B6F5E]">
        <p>
          Press Charm was born from a simple idea: everyone deserves
          salon-quality nails without the salon commitment. What started as a
          passion project in a small studio has grown into a brand dedicated to
          making beautiful, effortless nails accessible to all.
        </p>

        <p>
          Each set of press-on nails is thoughtfully designed and handcrafted
          with attention to detail. From classic neutrals to bold art pieces,
          our collections are curated for every mood, occasion, and
          personality. We believe your nails are an extension of your personal
          style, and they should be as unique as you are.
        </p>
      </div>

      {/* Accent Section */}
      <div className="mt-16 bg-gradient-to-br from-[#F0E8DF] via-[#FAF7F2] to-[#E8DDD4] rounded-lg p-8 md:p-12">
        <h2 className="font-heading text-lg font-light tracking-wide text-[#2C1810] mb-4">
          What We Stand For
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-6">
          <div>
            <h3 className="font-heading text-sm font-normal tracking-wide text-[#2C1810] mb-2">
              Quality First
            </h3>
            <p className="text-sm font-light text-[#8B6F5E] leading-relaxed">
              We use premium materials and adhesives to ensure a comfortable,
              long-lasting fit. Each set is inspected for quality before it
              reaches you.
            </p>
          </div>
          <div>
            <h3 className="font-heading text-sm font-normal tracking-wide text-[#2C1810] mb-2">
              Handcrafted with Care
            </h3>
            <p className="text-sm font-light text-[#8B6F5E] leading-relaxed">
              Our designs are hand-painted and meticulously assembled. No
              mass-production shortcuts -- just genuine artistry in every set.
            </p>
          </div>
          <div>
            <h3 className="font-heading text-sm font-normal tracking-wide text-[#2C1810] mb-2">
              Effortless Beauty
            </h3>
            <p className="text-sm font-light text-[#8B6F5E] leading-relaxed">
              Apply in minutes, wear for weeks. Our press-ons are designed to
              look natural, feel comfortable, and make your life a little more
              glamorous.
            </p>
          </div>
        </div>
      </div>

      {/* Closing */}
      <div className="mt-16 text-center">
        <p className="text-sm font-light text-[#8B6F5E] leading-relaxed max-w-2xl mx-auto">
          Thank you for choosing Press Charm. Every time you wear our nails,
          you carry a piece of our heart and creativity with you. We are so
          grateful to be part of your self-care routine.
        </p>
      </div>
    </section>
  );
}
