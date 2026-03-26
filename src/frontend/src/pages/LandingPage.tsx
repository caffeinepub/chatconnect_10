import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Globe,
  MessageCircle,
  Phone,
  Radio,
  Shield,
  Star,
  Users,
  Zap,
} from "lucide-react";
import { motion } from "motion/react";
import { SiGithub, SiInstagram, SiX } from "react-icons/si";

const SAMPLE_CARDS = [
  {
    name: "Alex Rivera",
    age: 24,
    status: "online",
    gradient: "from-purple-500 to-indigo-600",
    initials: "AR",
  },
  {
    name: "Mia Chen",
    age: 28,
    status: "online",
    gradient: "from-teal-400 to-cyan-500",
    initials: "MC",
  },
  {
    name: "Jordan Kim",
    age: 22,
    status: "away",
    gradient: "from-orange-400 to-pink-500",
    initials: "JK",
  },
  {
    name: "Sam Torres",
    age: 31,
    status: "online",
    gradient: "from-indigo-400 to-purple-600",
    initials: "ST",
  },
  {
    name: "Riley Park",
    age: 26,
    status: "online",
    gradient: "from-emerald-400 to-teal-500",
    initials: "RP",
  },
];

const FEATURES = [
  {
    icon: <MessageCircle className="h-5 w-5" />,
    title: "Live Lobby Chat",
    desc: "One shared room where everyone talks in real-time.",
  },
  {
    icon: <Phone className="h-5 w-5" />,
    title: "Voice Call Cards",
    desc: "Request voice calls instantly from anyone's profile card.",
  },
  {
    icon: <Users className="h-5 w-5" />,
    title: "Community Profiles",
    desc: "Personalized profiles with photos, names, and age badges.",
  },
];

const FOOTER_COLS = [
  {
    heading: "Product",
    links: ["Lobby", "Calling Cards", "Voice Calls", "Profiles"],
  },
  { heading: "Company", links: ["About", "Blog", "Careers", "Press"] },
  {
    heading: "Resources",
    links: ["Documentation", "Help Center", "Community", "Status"],
  },
  { heading: "Legal", links: ["Privacy", "Terms", "Cookies", "Licenses"] },
];

const SOCIAL_ICONS = [
  { Icon: SiGithub, label: "GitHub" },
  { Icon: SiX, label: "X (Twitter)" },
  { Icon: SiInstagram, label: "Instagram" },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background font-sans">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-border">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg gradient-hero flex items-center justify-center text-white font-display font-bold text-sm">
              W
            </div>
            <span className="font-display font-bold text-lg text-foreground">
              WaveChat
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            <a
              href="#features"
              className="hover:text-foreground transition-colors"
            >
              Features
            </a>
            <Link
              to="/lobby"
              className="hover:text-foreground transition-colors"
            >
              Lobby
            </Link>
            <a
              href="#community"
              className="hover:text-foreground transition-colors"
            >
              Community
            </a>
            <a
              href="#support"
              className="hover:text-foreground transition-colors"
            >
              Support
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <Link to="/login">
              <Button
                variant="outline"
                className="rounded-full px-5"
                data-ocid="nav.login_button"
              >
                Log In
              </Button>
            </Link>
            <Link to="/signup">
              <Button
                className="rounded-full px-5 btn-orange"
                data-ocid="nav.signup_button"
              >
                Sign Up Free
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="max-w-6xl mx-auto px-6 py-16">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="gradient-hero rounded-4xl p-10 md:p-14 flex flex-col md:flex-row gap-10 items-center overflow-hidden"
          >
            <div className="flex-1 text-white">
              <div className="inline-flex items-center gap-2 bg-white/20 rounded-full px-4 py-1.5 text-sm font-medium mb-6">
                <Zap className="h-3.5 w-3.5" />
                Real-time voice &amp; chat platform
              </div>
              <h1 className="font-display font-extrabold text-5xl md:text-6xl leading-tight mb-5">
                Connect, Chat &amp; Call in One Place
              </h1>
              <p className="text-white/80 text-lg leading-relaxed mb-8 max-w-md">
                Join the global WaveChat lobby, discover people through colorful
                calling cards, and start voice calls in seconds.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link to="/signup">
                  <Button
                    size="lg"
                    className="rounded-full text-white hover:opacity-90 font-semibold px-8 shadow-lg"
                    style={{ backgroundColor: "oklch(0.72 0.19 50)" }}
                    data-ocid="hero.signup_button"
                  >
                    Get Started Free <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link to="/lobby">
                  <Button
                    size="lg"
                    variant="outline"
                    className="rounded-full border-white/40 text-white bg-white/10 hover:bg-white/20 px-8"
                    data-ocid="hero.lobby_button"
                  >
                    Enter Lobby
                  </Button>
                </Link>
              </div>
              <div className="mt-8 flex items-center gap-6 text-white/70 text-sm">
                <div className="flex items-center gap-1.5">
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />{" "}
                  4.9/5 rating
                </div>
                <div className="flex items-center gap-1.5">
                  <Users className="h-4 w-4" /> 50K+ users
                </div>
                <div className="flex items-center gap-1.5">
                  <Globe className="h-4 w-4" /> 120+ countries
                </div>
              </div>
            </div>

            <div className="flex-1 flex justify-center relative">
              <div className="relative">
                <img
                  src="/assets/generated/chat-mockup.dim_600x400.png"
                  alt="WaveChat lobby preview"
                  className="rounded-2xl shadow-hero max-w-full w-[420px] border border-white/20"
                />
                <div className="absolute -bottom-6 -left-6 gradient-card rounded-2xl p-4 shadow-hero border border-white/10 text-white w-52">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center text-sm font-bold">
                      MC
                    </div>
                    <div>
                      <div className="font-semibold text-sm">Mia Chen</div>
                      <div className="text-xs text-white/60">
                        Age 28 · Online
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="w-full rounded-full py-1.5 text-xs font-semibold text-white"
                    style={{ backgroundColor: "oklch(0.72 0.19 50)" }}
                  >
                    📞 Request Call
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        {/* Features */}
        <section id="features" className="max-w-6xl mx-auto px-6 py-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="font-display font-bold text-4xl text-foreground mb-3">
              Core Features
            </h2>
            <p className="text-muted-foreground text-lg mb-10">
              Everything you need to connect with the world.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="bg-white rounded-3xl p-8 shadow-card border border-border hover:shadow-lg transition-shadow"
                data-ocid={`features.item.${i + 1}`}
              >
                <div className="w-12 h-12 rounded-2xl gradient-hero flex items-center justify-center text-white mb-5">
                  {f.icon}
                </div>
                <h3 className="font-display font-semibold text-xl text-foreground mb-2">
                  {f.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {f.desc}
                </p>
              </motion.div>
            ))}
          </div>

          <div className="mt-8 grid md:grid-cols-2 gap-6">
            {[
              {
                icon: <Shield className="h-5 w-5" />,
                title: "Secure Identity",
                desc: "Blockchain-powered authentication keeps your account safe.",
              },
              {
                icon: <Radio className="h-5 w-5" />,
                title: "Instant Connections",
                desc: "Low-latency messaging so conversations flow naturally.",
              },
            ].map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="bg-white rounded-3xl p-8 shadow-card border border-border hover:shadow-lg transition-shadow flex gap-5"
              >
                <div className="w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center text-primary flex-shrink-0">
                  {f.icon}
                </div>
                <div>
                  <h3 className="font-display font-semibold text-xl text-foreground mb-1">
                    {f.title}
                  </h3>
                  <p className="text-muted-foreground">{f.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Community Cards */}
        <section id="community" className="max-w-6xl mx-auto px-6 py-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="mb-10"
          >
            <h2 className="font-display font-bold text-4xl text-foreground mb-3">
              Meet Our Community
            </h2>
            <p className="text-muted-foreground text-lg">
              Discover people from around the world and start a conversation.
            </p>
          </motion.div>

          <div
            className="flex gap-5 overflow-x-auto pb-4 snap-x"
            style={{ scrollbarWidth: "none" }}
          >
            {SAMPLE_CARDS.map((card, i) => (
              <motion.div
                key={card.name}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className="gradient-card rounded-3xl p-6 text-white flex-shrink-0 w-52 snap-start border border-white/10 shadow-hero"
                data-ocid={`community.item.${i + 1}`}
              >
                <div className="flex flex-col items-center text-center">
                  <div
                    className={`w-16 h-16 rounded-full bg-gradient-to-br ${card.gradient} flex items-center justify-center text-white text-xl font-bold mb-3`}
                  >
                    {card.initials}
                  </div>
                  <div className="font-semibold text-base mb-0.5">
                    {card.name}
                  </div>
                  <div className="text-white/60 text-sm mb-1">
                    Age {card.age}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-white/50 mb-4">
                    <span
                      className={`w-2 h-2 rounded-full ${card.status === "online" ? "bg-green-400" : "bg-yellow-400"}`}
                    />
                    {card.status}
                  </div>
                  <div className="w-full flex flex-col gap-2">
                    <button
                      type="button"
                      className="w-full py-1.5 rounded-full bg-primary/80 text-white text-xs font-semibold hover:bg-primary transition-colors"
                    >
                      Message
                    </button>
                    <button
                      type="button"
                      className="w-full py-1.5 rounded-full text-white text-xs font-semibold hover:opacity-90 transition-opacity"
                      style={{ backgroundColor: "oklch(0.72 0.19 50)" }}
                    >
                      📞 Call
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="mt-10 text-center">
            <Link to="/signup">
              <Button
                size="lg"
                className="rounded-full px-10 font-semibold btn-orange"
                data-ocid="community.signup_button"
              >
                Join WaveChat <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer id="support" className="gradient-footer mt-16 text-white">
        <div className="max-w-6xl mx-auto px-6 py-14">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-10">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg gradient-hero flex items-center justify-center font-bold text-sm">
                  W
                </div>
                <span className="font-display font-bold text-lg">WaveChat</span>
              </div>
              <p className="text-white/50 text-sm leading-relaxed">
                Connect, chat, and call people from around the world.
              </p>
            </div>
            {FOOTER_COLS.map((col) => (
              <div key={col.heading}>
                <h4 className="font-semibold text-sm mb-4 text-white/90">
                  {col.heading}
                </h4>
                <ul className="space-y-2">
                  {col.links.map((l) => (
                    <li key={l}>
                      <a
                        href={`#${l.toLowerCase().replace(" ", "-")}`}
                        className="text-white/50 text-sm hover:text-white/80 transition-colors"
                      >
                        {l}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="border-t border-white/10 pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-white/40 text-sm">
              © {new Date().getFullYear()}. Built with ❤️ using{" "}
              <a
                href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(typeof window !== "undefined" ? window.location.hostname : "")}`}
                className="text-white/60 hover:text-white transition-colors"
                target="_blank"
                rel="noreferrer"
              >
                caffeine.ai
              </a>
            </p>
            <div className="flex items-center gap-4">
              {SOCIAL_ICONS.map(({ Icon, label }) => (
                <a
                  key={label}
                  href={`#${label}`}
                  className="text-white/40 hover:text-white transition-colors"
                  aria-label={label}
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
