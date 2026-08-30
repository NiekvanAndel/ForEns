/* @ds-bundle: {"format":4,"namespace":"ExactCastAIDesignSystem_6b62ae","components":[{"name":"Icon","sourcePath":"components/brand/Icon.jsx"},{"name":"Wordmark","sourcePath":"components/brand/Wordmark.jsx"},{"name":"Badge","sourcePath":"components/core/Badge.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Card","sourcePath":"components/core/Card.jsx"},{"name":"Eyebrow","sourcePath":"components/core/Eyebrow.jsx"},{"name":"LinkArrow","sourcePath":"components/core/LinkArrow.jsx"},{"name":"SectionHeading","sourcePath":"components/core/SectionHeading.jsx"},{"name":"ComparisonTable","sourcePath":"components/data/ComparisonTable.jsx"},{"name":"MeasurementRow","sourcePath":"components/data/MeasurementRow.jsx"},{"name":"MeterBar","sourcePath":"components/data/MeterBar.jsx"},{"name":"MetricCard","sourcePath":"components/data/MetricCard.jsx"},{"name":"ResultRow","sourcePath":"components/data/ResultRow.jsx"},{"name":"ScaleBar","sourcePath":"components/data/ScaleBar.jsx"},{"name":"StatTile","sourcePath":"components/data/StatTile.jsx"},{"name":"StatusDot","sourcePath":"components/data/StatusDot.jsx"},{"name":"Accordion","sourcePath":"components/feedback/Accordion.jsx"},{"name":"Callout","sourcePath":"components/feedback/Callout.jsx"},{"name":"StatusCard","sourcePath":"components/feedback/StatusCard.jsx"},{"name":"WarnBox","sourcePath":"components/feedback/WarnBox.jsx"},{"name":"Field","sourcePath":"components/forms/Field.jsx"},{"name":"Input","sourcePath":"components/forms/Input.jsx"},{"name":"Select","sourcePath":"components/forms/Select.jsx"},{"name":"CtaBand","sourcePath":"components/marketing/CtaBand.jsx"},{"name":"PhoneMock","sourcePath":"components/marketing/PhoneMock.jsx"},{"name":"PlanCard","sourcePath":"components/marketing/PlanCard.jsx"},{"name":"SpecCard","sourcePath":"components/marketing/SpecCard.jsx"},{"name":"Testimonial","sourcePath":"components/marketing/Testimonial.jsx"},{"name":"TrustBar","sourcePath":"components/marketing/TrustBar.jsx"},{"name":"PillTabs","sourcePath":"components/navigation/PillTabs.jsx"},{"name":"SiteFooter","sourcePath":"components/navigation/SiteFooter.jsx"},{"name":"SiteHeader","sourcePath":"components/navigation/SiteHeader.jsx"},{"name":"TabBar","sourcePath":"components/navigation/TabBar.jsx"}],"sourceHashes":{"components/brand/Icon.jsx":"abb3290524b3","components/brand/Wordmark.jsx":"bc3225bc84a2","components/core/Badge.jsx":"2489e1c0cc0e","components/core/Button.jsx":"099248e9f88c","components/core/Card.jsx":"4d37d66857db","components/core/Eyebrow.jsx":"40510fca7e42","components/core/LinkArrow.jsx":"fa303d324885","components/core/SectionHeading.jsx":"ef58ae665359","components/data/ComparisonTable.jsx":"709a14a7fd1b","components/data/MeasurementRow.jsx":"9d77ae3d9b1e","components/data/MeterBar.jsx":"0ca995f0a173","components/data/MetricCard.jsx":"76b468b1ca31","components/data/ResultRow.jsx":"a9a6bcecdb80","components/data/ScaleBar.jsx":"f1cd7e90d258","components/data/StatTile.jsx":"d499115ddfd9","components/data/StatusDot.jsx":"791a1388e0d4","components/feedback/Accordion.jsx":"3899ae5dada6","components/feedback/Callout.jsx":"abbb3cf5e7f2","components/feedback/StatusCard.jsx":"d4e53359a610","components/feedback/WarnBox.jsx":"0c7ec23f392c","components/forms/Field.jsx":"7f543c71b457","components/forms/Input.jsx":"5f8754b8ebed","components/forms/Select.jsx":"75694e6e10f2","components/marketing/CtaBand.jsx":"0bcf2213a750","components/marketing/PhoneMock.jsx":"25b32aff24f1","components/marketing/PlanCard.jsx":"9fa9ab168b20","components/marketing/SpecCard.jsx":"249c409550ab","components/marketing/Testimonial.jsx":"0ec7af92bcee","components/marketing/TrustBar.jsx":"1ea0f05b91cd","components/navigation/PillTabs.jsx":"ab5764784a31","components/navigation/SiteFooter.jsx":"ce2bc1f0c1b5","components/navigation/SiteHeader.jsx":"17bd391b83fd","components/navigation/TabBar.jsx":"302bdc1a286b","ui_kits/exactcast-ios/AppChrome.jsx":"24d34a7422cb","ui_kits/exactcast-ios/ForecastScreen.jsx":"9dbf38c8c2a6","ui_kits/exactcast-ios/NowcastScreen.jsx":"43de1ca0de46","ui_kits/exactcast-ios/RadarScreen.jsx":"025478694a94","ui_kits/exactcast-ios/SettingsScreen.jsx":"b82cbe120f2a","ui_kits/exactcast-web/HeroSection.jsx":"985b81dc149c","ui_kits/exactcast-web/HomePage.jsx":"1b2c3485c253","ui_kits/exactcast-web/NetworkPage.jsx":"e42f90b243c4","ui_kits/exactcast-web/PricingPage.jsx":"c4d152896a23"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.ExactCastAIDesignSystem_6b62ae = window.ExactCastAIDesignSystem_6b62ae || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/brand/Icon.jsx
try { (() => {
/* Icon set = Phosphor Icons, the closest CDN match to standard iOS SF Symbols:
   rounded caps, even optical weight, and a filled twin for selected states —
   the same regular/filled pairing iOS uses in tab bars.
   Lucide is kept only for the marketing site, whose source markup embeds
   verbatim Lucide paths (arrow-right, phone). Nothing here is hand-drawn. */
const PHOSPHOR = 'https://unpkg.com/@phosphor-icons/core@2.1.1/assets/';
const LUCIDE = 'https://unpkg.com/lucide-static@0.544.0/icons/';
function url(name, set, weight) {
  if (set === 'lucide') return LUCIDE + name + '.svg';
  const w = weight || 'regular';
  return PHOSPHOR + w + '/' + name + (w === 'regular' ? '' : '-' + w) + '.svg';
}
function Icon({
  name,
  size = 20,
  set = 'phosphor',
  weight = 'regular',
  style
}) {
  const u = url(name, set, weight);
  return /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    style: {
      display: 'inline-block',
      width: size + 'px',
      height: size + 'px',
      flex: '0 0 auto',
      background: 'currentColor',
      WebkitMaskImage: 'url(' + u + ')',
      maskImage: 'url(' + u + ')',
      WebkitMaskRepeat: 'no-repeat',
      maskRepeat: 'no-repeat',
      WebkitMaskPosition: 'center',
      maskPosition: 'center',
      WebkitMaskSize: 'contain',
      maskSize: 'contain',
      ...style
    }
  });
}
Object.assign(__ds_scope, { Icon });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/brand/Icon.jsx", error: String((e && e.message) || e) }); }

// components/brand/Wordmark.jsx
try { (() => {
/* No logo file was supplied with the source material, so the brand is set in type.
   The accent is deliberately the cool precipitation blue, NOT the agricultural green:
   ExactCast is a consumer rain app, and green reads as farming.
   Replace this component's internals the moment a real mark lands in assets/. */
function Wordmark({
  tone = 'navy',
  size = 20,
  pill,
  style
}) {
  const light = tone === 'light';
  const color = light ? '#fff' : 'var(--ink-heading)';
  const accent = light ? 'var(--app-accent-dark)' : 'var(--app-accent)';
  const inner = (c, a) => /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-core)',
      fontSize: size + 'px',
      lineHeight: 1,
      letterSpacing: '-.015em',
      color: c,
      whiteSpace: 'nowrap'
    }
  }, /*#__PURE__*/React.createElement("strong", {
    style: {
      fontWeight: 'var(--fw-black)'
    }
  }, "Exact"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 'var(--fw-medium)'
    }
  }, "Cast"), /*#__PURE__*/React.createElement("span", {
    style: {
      color: a,
      fontWeight: 'var(--fw-black)'
    }
  }, " AI"));
  if (!pill) return /*#__PURE__*/React.createElement("span", {
    style: style
  }, inner(color, accent));
  return /*#__PURE__*/React.createElement("span", {
    style: {
      background: '#fff',
      borderRadius: 'var(--radius-pill)',
      padding: '8px 18px',
      display: 'inline-flex',
      alignItems: 'center',
      ...style
    }
  }, inner('var(--ink-heading)', 'var(--app-accent)'));
}
Object.assign(__ds_scope, { Wordmark });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/brand/Wordmark.jsx", error: String((e && e.message) || e) }); }

// components/core/Badge.jsx
try { (() => {
const tones = {
  green: {
    background: 'var(--gradient-primary)',
    color: '#fff'
  },
  amber: {
    background: 'var(--status-amber-tint)',
    color: 'var(--status-amber-ink)'
  },
  navy: {
    background: 'var(--navy-panel)',
    color: '#fff'
  }
};
function Badge({
  children,
  tone = 'green',
  square,
  style
}) {
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-block',
      borderRadius: square ? '6px' : 'var(--radius-pill)',
      padding: square ? '1px 7px' : '4px 12px',
      fontFamily: 'var(--font-core)',
      fontSize: square ? 'var(--fs-tag)' : '12px',
      fontWeight: 'var(--fw-bold)',
      letterSpacing: square ? '.02em' : undefined,
      lineHeight: 1.45,
      ...tones[tone],
      ...style
    }
  }, children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Badge.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
const base = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  borderRadius: 'var(--radius-pill)',
  fontFamily: 'var(--font-core)',
  fontWeight: 'var(--fw-semibold)',
  fontSize: 'var(--fs-body)',
  lineHeight: 1,
  textDecoration: 'none',
  border: 0,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  transition: 'var(--dur-fast)'
};
const variants = {
  primary: {
    background: 'var(--gradient-primary)',
    color: '#fff'
  },
  ghost: {
    background: 'transparent',
    color: '#fff',
    border: 'var(--border-width-ghost) solid var(--border-on-navy)'
  },
  'ghost-dark': {
    background: 'transparent',
    color: 'var(--ink-heading)',
    border: 'var(--border-width-ghost) solid var(--border-ghost)'
  },
  white: {
    background: '#fff',
    color: 'var(--green-dark)'
  }
};
const hovers = {
  primary: {
    filter: 'var(--brighten-hover)',
    transform: 'var(--lift-hover)'
  },
  ghost: {
    borderColor: 'var(--border-on-navy-hover)'
  },
  'ghost-dark': {
    borderColor: 'var(--border-ghost-hover)'
  },
  white: {
    filter: 'var(--brighten-hover)',
    transform: 'var(--lift-hover)'
  }
};
function Button({
  variant = 'primary',
  size = 'md',
  href,
  children,
  icon,
  disabled,
  full,
  onClick,
  style
}) {
  const [hover, setHover] = React.useState(false);
  const Tag = href ? 'a' : 'button';
  const s = {
    ...base,
    ...variants[variant],
    padding: size === 'sm' ? 'var(--btn-pad-sm)' : 'var(--btn-pad)',
    width: full ? '100%' : undefined,
    opacity: disabled ? .45 : 1,
    pointerEvents: disabled ? 'none' : undefined,
    ...(hover && !disabled ? hovers[variant] : null),
    ...style
  };
  return /*#__PURE__*/React.createElement(Tag, {
    href: href,
    onClick: onClick,
    disabled: Tag === 'button' ? disabled : undefined,
    style: s,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false)
  }, children, icon);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/Card.jsx
try { (() => {
function Card({
  children,
  pad = 'var(--card-pad)',
  radius = 'var(--radius-card)',
  alt,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: alt ? 'var(--cream-2)' : 'var(--white)',
      borderRadius: radius,
      boxShadow: alt ? 'none' : 'var(--shadow-card)',
      padding: pad,
      ...style
    }
  }, children);
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Card.jsx", error: String((e && e.message) || e) }); }

// components/core/Eyebrow.jsx
try { (() => {
function Eyebrow({
  children,
  tone = 'green',
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-core)',
      fontSize: 'var(--fs-eyebrow)',
      fontWeight: 'var(--fw-bold)',
      letterSpacing: 'var(--ls-eyebrow)',
      textTransform: 'uppercase',
      color: tone === 'light' ? 'var(--green)' : 'var(--green-dark)',
      marginBottom: '12px',
      ...style
    }
  }, children);
}
Object.assign(__ds_scope, { Eyebrow });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Eyebrow.jsx", error: String((e && e.message) || e) }); }

// components/core/LinkArrow.jsx
try { (() => {
function LinkArrow({
  href = '#',
  children,
  onClick,
  tone = 'dark',
  style
}) {
  const [h, setH] = React.useState(false);
  return /*#__PURE__*/React.createElement("a", {
    href: href,
    onClick: onClick,
    onMouseEnter: () => setH(true),
    onMouseLeave: () => setH(false),
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '8px',
      fontFamily: 'var(--font-core)',
      fontWeight: 'var(--fw-semibold)',
      fontSize: 'var(--fs-body)',
      textDecoration: 'none',
      color: tone === 'light' ? '#fff' : 'var(--ink-heading)',
      ...style
    }
  }, children, /*#__PURE__*/React.createElement("svg", {
    width: "18",
    height: "18",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.5",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    style: {
      transition: 'var(--dur-fast)',
      transform: h ? 'translateX(4px)' : 'none'
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M5 12h14"
  }), /*#__PURE__*/React.createElement("path", {
    d: "m12 5 7 7-7 7"
  })));
}
Object.assign(__ds_scope, { LinkArrow });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/LinkArrow.jsx", error: String((e && e.message) || e) }); }

// components/core/SectionHeading.jsx
try { (() => {
function SectionHeading({
  eyebrow,
  title,
  lead,
  center,
  tone = 'dark',
  maxWidth = '760px',
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth,
      margin: center ? '0 auto' : undefined,
      textAlign: center ? 'center' : 'left',
      ...style
    }
  }, eyebrow ? /*#__PURE__*/React.createElement(__ds_scope.Eyebrow, {
    tone: tone === 'light' ? 'light' : 'green'
  }, eyebrow) : null, /*#__PURE__*/React.createElement("h2", {
    style: {
      margin: 0,
      fontFamily: 'var(--font-core)',
      fontSize: 'var(--fs-h2)',
      lineHeight: 'var(--lh-h2)',
      fontWeight: 'var(--fw-semibold)',
      color: tone === 'light' ? '#fff' : 'var(--ink-heading)'
    }
  }, title), lead ? /*#__PURE__*/React.createElement("p", {
    style: {
      marginTop: '14px',
      marginBottom: 0,
      fontSize: 'var(--fs-lead)',
      lineHeight: 'var(--lh-lead)',
      color: tone === 'light' ? 'var(--on-navy-body)' : 'var(--muted)'
    }
  }, lead) : null);
}
Object.assign(__ds_scope, { SectionHeading });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/SectionHeading.jsx", error: String((e && e.message) || e) }); }

// components/data/ComparisonTable.jsx
try { (() => {
function ComparisonTable({
  columns = [],
  rows = [],
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: '#fff',
      borderRadius: 'var(--radius-card)',
      boxShadow: 'var(--shadow-card)',
      overflow: 'hidden',
      ...style
    }
  }, /*#__PURE__*/React.createElement("table", {
    style: {
      width: '100%',
      borderCollapse: 'separate',
      borderSpacing: 0,
      fontFamily: 'var(--font-core)'
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", {
    style: {
      background: 'var(--navy-panel)',
      padding: '16px 18px',
      textAlign: 'left'
    }
  }), columns.map((c, i) => /*#__PURE__*/React.createElement("th", {
    key: i,
    style: {
      padding: '16px 18px',
      textAlign: 'left',
      fontSize: 'var(--fs-label)',
      fontWeight: 'var(--fw-semibold)',
      color: '#fff',
      background: i === columns.length - 1 ? 'var(--gradient-primary)' : 'var(--navy-panel)'
    }
  }, c)))), /*#__PURE__*/React.createElement("tbody", null, rows.map((r, ri) => {
    const last = ri === rows.length - 1;
    return /*#__PURE__*/React.createElement("tr", {
      key: ri
    }, /*#__PURE__*/React.createElement("th", {
      style: {
        padding: '16px 18px',
        textAlign: 'left',
        fontSize: 'var(--fs-body-sm)',
        fontWeight: 'var(--fw-semibold)',
        color: 'var(--ink-heading)',
        width: '34%',
        borderBottom: last ? 0 : '1px solid var(--hairline-soft)'
      }
    }, r.label), r.cells.map((cell, ci) => {
      const isLast = ci === r.cells.length - 1;
      return /*#__PURE__*/React.createElement("td", {
        key: ci,
        style: {
          padding: '16px 18px',
          fontSize: 'var(--fs-body-sm)',
          color: isLast ? 'var(--ink-heading)' : 'var(--muted)',
          fontWeight: isLast ? 'var(--fw-semibold)' : 'var(--fw-regular)',
          background: isLast ? 'var(--green-tint)' : undefined,
          borderBottom: last ? 0 : '1px solid var(--hairline-soft)'
        }
      }, cell === '—' ? /*#__PURE__*/React.createElement("span", {
        style: {
          color: 'var(--ink-disabled)'
        }
      }, "\u2014") : cell);
    }));
  }))));
}
Object.assign(__ds_scope, { ComparisonTable });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/ComparisonTable.jsx", error: String((e && e.message) || e) }); }

// components/data/MeterBar.jsx
try { (() => {
function MeterBar({
  leftLabel,
  rightLabel,
  pct = 50,
  tone = 'save',
  onNavy = true,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: style
  }, leftLabel || rightLabel ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: 'var(--fs-caption)',
      color: onNavy ? 'var(--on-navy-muted)' : 'var(--muted)',
      marginBottom: '5px'
    }
  }, /*#__PURE__*/React.createElement("span", null, leftLabel), /*#__PURE__*/React.createElement("span", null, rightLabel)) : null, /*#__PURE__*/React.createElement("div", {
    style: {
      height: '14px',
      borderRadius: '7px',
      background: onNavy ? 'var(--track-on-navy)' : 'rgba(12,37,71,.09)',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("i", {
    style: {
      display: 'block',
      height: '100%',
      width: Math.max(0, Math.min(100, pct)) + '%',
      borderRadius: '7px',
      background: tone === 'save' ? 'linear-gradient(90deg,var(--green),var(--green-dark))' : onNavy ? 'var(--fill-on-navy)' : 'var(--ink-disabled)'
    }
  })));
}
Object.assign(__ds_scope, { MeterBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/MeterBar.jsx", error: String((e && e.message) || e) }); }

// components/data/MetricCard.jsx
try { (() => {
function MetricCard({
  label,
  value,
  unit,
  footnote,
  tone = 'default',
  onClick,
  style
}) {
  const colors = {
    default: 'var(--app-value)',
    cool: 'var(--app-value-cool)',
    warm: 'var(--app-value-warm)',
    empty: 'var(--muted)'
  };
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClick,
    style: {
      background: 'var(--app-card)',
      borderRadius: 'var(--radius-app-card)',
      boxShadow: 'var(--shadow-card)',
      padding: '18px 16px 14px',
      textAlign: 'center',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '10px',
      minHeight: '150px',
      cursor: onClick ? 'pointer' : 'default',
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-core)',
      fontSize: 'var(--fs-body)',
      fontWeight: 'var(--fw-bold)',
      color: 'var(--ink-heading)',
      lineHeight: 1.3
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: '4px',
      fontFamily: 'var(--font-numeric)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: value === '–' ? '32px' : 'var(--fs-metric-app)',
      fontWeight: 'var(--fw-bold)',
      color: value === '–' ? 'var(--muted)' : colors[tone],
      lineHeight: 1
    }
  }, value), unit ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--fs-body)',
      fontWeight: 'var(--fw-semibold)',
      color: 'var(--muted)'
    }
  }, unit) : null), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--fs-body-sm)',
      color: 'var(--muted)'
    }
  }, footnote));
}
Object.assign(__ds_scope, { MetricCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/MetricCard.jsx", error: String((e && e.message) || e) }); }

// components/data/ResultRow.jsx
try { (() => {
function ResultRow({
  label,
  value,
  highlight,
  last,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      gap: '16px',
      padding: '13px 0',
      borderBottom: last ? 0 : '1px solid var(--rule-on-navy)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--fs-ui)',
      color: 'var(--on-navy-soft)'
    }
  }, label), /*#__PURE__*/React.createElement("b", {
    style: {
      fontSize: highlight ? '22px' : 'var(--fs-h4)',
      fontWeight: 'var(--fw-bold)',
      color: highlight ? 'var(--green)' : '#fff',
      whiteSpace: 'nowrap'
    }
  }, value));
}
Object.assign(__ds_scope, { ResultRow });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/ResultRow.jsx", error: String((e && e.message) || e) }); }

// components/data/ScaleBar.jsx
try { (() => {
function ScaleBar({
  segments = [{
    tone: 'dry'
  }, {
    tone: 'light'
  }, {
    tone: 'heavy'
  }],
  scale = [],
  legend = [],
  style
}) {
  const c = {
    dry: 'var(--status-dry)',
    light: 'var(--status-light)',
    heavy: 'var(--status-heavy)',
    green: 'var(--status-dry)',
    amber: 'var(--status-light)',
    red: 'var(--status-heavy)'
  };
  return /*#__PURE__*/React.createElement("div", {
    style: style
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: '22px',
      borderRadius: '11px',
      overflow: 'hidden',
      display: 'flex'
    }
  }, segments.map((s, i) => /*#__PURE__*/React.createElement("i", {
    key: i,
    style: {
      flex: s.flex || 1,
      background: c[s.tone]
    }
  }))), scale.length ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: 'var(--fs-caption)',
      color: 'var(--muted)',
      marginTop: '10px'
    }
  }, scale.map((t, i) => /*#__PURE__*/React.createElement("span", {
    key: i
  }, t))) : null, legend.length ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(' + legend.length + ',1fr)',
      gap: '18px',
      marginTop: '20px'
    }
  }, legend.map((l, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      fontSize: 'var(--fs-ui)',
      color: 'var(--muted)',
      lineHeight: 1.6
    }
  }, /*#__PURE__*/React.createElement("b", {
    style: {
      display: 'block',
      color: 'var(--ink-heading)',
      marginBottom: '3px'
    }
  }, l.title), l.body))) : null);
}
Object.assign(__ds_scope, { ScaleBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/ScaleBar.jsx", error: String((e && e.message) || e) }); }

// components/data/StatTile.jsx
try { (() => {
function StatTile({
  value,
  label,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--cream-2)',
      borderRadius: 'var(--radius-tile)',
      padding: '16px 14px',
      textAlign: 'center',
      ...style
    }
  }, /*#__PURE__*/React.createElement("b", {
    style: {
      display: 'block',
      fontSize: 'var(--fs-stat)',
      fontWeight: 'var(--fw-bold)',
      color: 'var(--green-dark)',
      lineHeight: 1.15
    }
  }, value), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      fontSize: 'var(--fs-caption)',
      color: 'var(--muted)',
      lineHeight: 1.35,
      marginTop: '4px'
    }
  }, label));
}
Object.assign(__ds_scope, { StatTile });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/StatTile.jsx", error: String((e && e.message) || e) }); }

// components/data/StatusDot.jsx
try { (() => {
const map = {
  dry: 'dry',
  light: 'light',
  heavy: 'heavy',
  green: 'dry',
  amber: 'light',
  red: 'heavy'
};
const fill = {
  dry: 'var(--status-dry)',
  light: 'var(--status-light)',
  heavy: 'var(--status-heavy)'
};
function StatusDot({
  status = 'dry',
  size = 12,
  style
}) {
  const k = map[status] || 'dry';
  return /*#__PURE__*/React.createElement("span", {
    style: {
      width: size + 'px',
      height: size + 'px',
      flex: '0 0 ' + size + 'px',
      borderRadius: '50%',
      background: fill[k],
      boxShadow: k === 'dry' ? 'inset 0 0 0 1.5px var(--status-dry-edge)' : 'none',
      display: 'inline-block',
      ...style
    }
  });
}
Object.assign(__ds_scope, { StatusDot });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/StatusDot.jsx", error: String((e && e.message) || e) }); }

// components/data/MeasurementRow.jsx
try { (() => {
const advColor = {
  dry: 'var(--status-dry-ink)',
  light: 'var(--status-light-ink)',
  heavy: 'var(--status-heavy-ink)'
};
const alias = {
  dry: 'dry',
  light: 'light',
  heavy: 'heavy',
  green: 'dry',
  amber: 'light',
  red: 'heavy'
};
function MeasurementRow({
  status = 'dry',
  name,
  meta,
  advice,
  compact,
  style
}) {
  const key = alias[status] || 'dry';
  const s = compact ? {
    fs: 11,
    ms: 10,
    as: 11,
    pad: '9px 10px',
    r: '11px',
    dot: 12
  } : {
    fs: 15,
    ms: 13,
    as: 14.5,
    pad: '12px 14px',
    r: 'var(--radius-tile)',
    dot: 14
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      padding: s.pad,
      borderRadius: s.r,
      background: '#F6F8FA',
      ...style
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.StatusDot, {
    status: status,
    size: s.dot
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: s.fs + 'px',
      fontWeight: 'var(--fw-semibold)',
      color: 'var(--ink-heading)',
      lineHeight: 1.25
    }
  }, name), meta ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: s.ms + 'px',
      color: 'var(--muted)'
    }
  }, meta) : null), advice ? /*#__PURE__*/React.createElement("div", {
    style: {
      marginLeft: 'auto',
      fontSize: s.as + 'px',
      fontWeight: 'var(--fw-bold)',
      color: advColor[key],
      whiteSpace: 'nowrap'
    }
  }, advice) : null);
}
Object.assign(__ds_scope, { MeasurementRow });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/MeasurementRow.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Accordion.jsx
try { (() => {
function Accordion({
  items = [],
  style
}) {
  const [open, setOpen] = React.useState(-1);
  return /*#__PURE__*/React.createElement("div", {
    style: style
  }, items.map((it, i) => {
    const isOpen = open === i;
    return /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        background: '#fff',
        borderRadius: 'var(--radius-tile)',
        boxShadow: 'var(--shadow-card)',
        marginBottom: '12px',
        overflow: 'hidden'
      }
    }, /*#__PURE__*/React.createElement("button", {
      onClick: () => setOpen(isOpen ? -1 : i),
      style: {
        width: '100%',
        background: 'none',
        border: 0,
        cursor: 'pointer',
        textAlign: 'left',
        padding: '18px 22px',
        fontFamily: 'var(--font-core)',
        fontWeight: 'var(--fw-semibold)',
        color: 'var(--ink-heading)',
        fontSize: '16.5px',
        display: 'flex',
        justifyContent: 'space-between',
        gap: '16px',
        alignItems: 'center'
      }
    }, it.q, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: '22px',
        color: 'var(--green-dark)',
        fontWeight: 'var(--fw-regular)',
        lineHeight: 1
      }
    }, isOpen ? '–' : '+')), isOpen ? /*#__PURE__*/React.createElement("div", {
      style: {
        padding: '0 22px 20px',
        fontSize: '15.5px',
        color: 'var(--muted)',
        lineHeight: 1.7
      }
    }, it.a) : null);
  }));
}
Object.assign(__ds_scope, { Accordion });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Accordion.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Callout.jsx
try { (() => {
function Callout({
  title,
  children,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: '#fff',
      borderLeft: 'var(--accent-bar) solid var(--green)',
      borderRadius: 'var(--radius-tile)',
      boxShadow: 'var(--shadow-card)',
      padding: '22px 24px',
      ...style
    }
  }, title ? /*#__PURE__*/React.createElement("h3", {
    style: {
      margin: '0 0 8px',
      fontFamily: 'var(--font-core)',
      fontSize: 'var(--fs-h4)',
      fontWeight: 'var(--fw-semibold)',
      color: 'var(--ink-heading)',
      lineHeight: 1.35
    }
  }, title) : null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--fs-body-sm)',
      color: 'var(--muted)',
      lineHeight: 1.65
    }
  }, children));
}
Object.assign(__ds_scope, { Callout });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Callout.jsx", error: String((e && e.message) || e) }); }

// components/feedback/StatusCard.jsx
try { (() => {
const c = {
  dry: 'var(--status-dry)',
  light: 'var(--status-light)',
  heavy: 'var(--status-heavy)'
};
const alias = {
  dry: 'dry',
  light: 'light',
  heavy: 'heavy',
  green: 'dry',
  amber: 'light',
  red: 'heavy'
};
function StatusCard({
  status = 'dry',
  title,
  children,
  style
}) {
  const k = alias[status] || 'dry';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: '#fff',
      borderRadius: 'var(--radius-card)',
      boxShadow: 'var(--shadow-card)',
      padding: '22px',
      borderTop: 'var(--accent-top) solid ' + c[k],
      ...style
    }
  }, /*#__PURE__*/React.createElement("b", {
    style: {
      display: 'block',
      marginBottom: '6px',
      fontFamily: 'var(--font-core)',
      color: 'var(--ink-heading)'
    }
  }, title), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 'var(--fs-body-sm)',
      color: 'var(--muted)',
      lineHeight: 1.6
    }
  }, children));
}
Object.assign(__ds_scope, { StatusCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/StatusCard.jsx", error: String((e && e.message) || e) }); }

// components/feedback/WarnBox.jsx
try { (() => {
function WarnBox({
  title,
  children,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--warn-bg)',
      border: '1px solid var(--warn-border)',
      borderRadius: 'var(--radius-tile)',
      padding: '18px 20px',
      ...style
    }
  }, title ? /*#__PURE__*/React.createElement("b", {
    style: {
      display: 'block',
      color: 'var(--warn-title)',
      marginBottom: '8px',
      fontFamily: 'var(--font-core)',
      fontSize: '15.5px',
      lineHeight: 1.4
    }
  }, title) : null, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 'var(--fs-label)',
      color: 'var(--on-navy-soft)',
      lineHeight: 1.6
    }
  }, children));
}
Object.assign(__ds_scope, { WarnBox });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/WarnBox.jsx", error: String((e && e.message) || e) }); }

// components/forms/Field.jsx
try { (() => {
function Field({
  label,
  hint,
  children,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 'var(--space-6)',
      ...style
    }
  }, label ? /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'block',
      fontFamily: 'var(--font-core)',
      fontSize: 'var(--fs-label)',
      fontWeight: 'var(--fw-semibold)',
      color: 'var(--ink-heading)',
      marginBottom: '6px'
    }
  }, label, hint ? /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      fontSize: 'var(--fs-caption)',
      fontWeight: 'var(--fw-regular)',
      color: 'var(--muted)',
      marginTop: '3px'
    }
  }, hint) : null) : null, children);
}
Object.assign(__ds_scope, { Field });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Field.jsx", error: String((e && e.message) || e) }); }

// components/forms/Input.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Input({
  value,
  onChange,
  placeholder,
  type = 'text',
  size = 'md',
  invalid,
  style,
  ...rest
}) {
  const [focus, setFocus] = React.useState(false);
  return /*#__PURE__*/React.createElement("input", _extends({
    type: type,
    value: value,
    onChange: onChange,
    placeholder: placeholder,
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false)
  }, rest, {
    style: {
      width: '100%',
      padding: size === 'sm' ? '10px 12px' : size === 'md' ? '11px 13px' : 'var(--field-pad)',
      border: 'var(--border-width-field) solid ' + (invalid ? 'var(--status-red)' : focus ? 'var(--green)' : 'var(--border-field)'),
      borderRadius: size === 'sm' ? '9px' : 'var(--radius-field)',
      fontFamily: 'var(--font-core)',
      fontSize: size === 'lg' ? 'var(--fs-body)' : size === 'sm' ? 'var(--fs-ui)' : 'var(--fs-body-sm)',
      color: 'var(--ink-heading)',
      background: '#fff',
      outline: 0,
      boxShadow: focus ? '0 0 0 3px var(--green-focus-ring)' : 'none',
      ...style
    }
  }));
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Input.jsx", error: String((e && e.message) || e) }); }

// components/forms/Select.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Select({
  value,
  onChange,
  options = [],
  style,
  ...rest
}) {
  const [focus, setFocus] = React.useState(false);
  return /*#__PURE__*/React.createElement("select", _extends({
    value: value,
    onChange: onChange,
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false)
  }, rest, {
    style: {
      width: '100%',
      padding: '11px 13px',
      border: 'var(--border-width-field) solid ' + (focus ? 'var(--green)' : 'var(--border-field)'),
      borderRadius: 'var(--radius-field)',
      fontFamily: 'var(--font-core)',
      fontSize: 'var(--fs-body-sm)',
      color: 'var(--ink-heading)',
      background: '#fff',
      outline: 0,
      boxShadow: focus ? '0 0 0 3px var(--green-focus-ring)' : 'none',
      ...style
    }
  }), options.map(o => {
    const v = typeof o === 'string' ? o : o.value,
      l = typeof o === 'string' ? o : o.label;
    return /*#__PURE__*/React.createElement("option", {
      key: v,
      value: v
    }, l);
  }));
}
Object.assign(__ds_scope, { Select });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Select.jsx", error: String((e && e.message) || e) }); }

// components/marketing/CtaBand.jsx
try { (() => {
function CtaBand({
  title,
  body,
  children,
  bullets,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--gradient-band)',
      borderRadius: 'var(--radius-band)',
      padding: '56px',
      display: 'grid',
      gridTemplateColumns: bullets ? '1fr 1fr' : '1fr',
      gap: '40px',
      alignItems: 'center',
      color: '#fff',
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h2", {
    style: {
      margin: '0 0 14px',
      fontFamily: 'var(--font-core)',
      fontSize: 'var(--fs-h2)',
      lineHeight: 'var(--lh-h2)',
      fontWeight: 'var(--fw-semibold)',
      color: '#fff'
    }
  }, title), /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'rgba(255,255,255,.9)',
      fontSize: 'var(--fs-lead)',
      lineHeight: 1.6,
      margin: '0 0 24px'
    }
  }, body), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: '12px',
      flexWrap: 'wrap'
    }
  }, children)), bullets ? /*#__PURE__*/React.createElement("ul", {
    style: {
      margin: 0,
      paddingLeft: '20px',
      color: 'rgba(255,255,255,.92)',
      fontSize: '15.5px',
      lineHeight: 1.9
    }
  }, bullets.map(b => /*#__PURE__*/React.createElement("li", {
    key: b
  }, b))) : null);
}
Object.assign(__ds_scope, { CtaBand });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/marketing/CtaBand.jsx", error: String((e && e.message) || e) }); }

// components/marketing/PhoneMock.jsx
try { (() => {
function PhoneMock({
  children,
  width = 236,
  small,
  title,
  time = '20:52',
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: (small ? 196 : width) + 'px',
      background: '#0d1b2e',
      borderRadius: 'var(--radius-phone)',
      padding: '9px',
      boxShadow: 'var(--shadow-phone)',
      opacity: small ? .9 : 1,
      transform: small ? 'translateY(22px)' : 'none',
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--cream)',
      borderRadius: 'var(--radius-screen)',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--navy-panel)',
      color: '#fff',
      padding: '10px 14px',
      fontSize: '11px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      fontFamily: 'var(--font-core)'
    }
  }, /*#__PURE__*/React.createElement("span", null, time), /*#__PURE__*/React.createElement("span", null, title)), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '12px 12px 16px'
    }
  }, children)));
}
Object.assign(__ds_scope, { PhoneMock });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/marketing/PhoneMock.jsx", error: String((e && e.message) || e) }); }

// components/marketing/PlanCard.jsx
try { (() => {
function PlanCard({
  name,
  amount,
  per,
  features = [],
  best,
  tag = 'Meest gekozen',
  cta,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: '#fff',
      borderRadius: 'var(--radius-card)',
      boxShadow: 'var(--shadow-card)',
      padding: '26px',
      position: 'relative',
      outline: best ? '2px solid var(--green)' : 'none',
      ...style
    }
  }, best ? /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      top: '-12px',
      left: '26px',
      background: 'var(--gradient-primary)',
      color: '#fff',
      fontSize: '12px',
      fontWeight: 'var(--fw-bold)',
      padding: '4px 12px',
      borderRadius: 'var(--radius-pill)',
      fontFamily: 'var(--font-core)'
    }
  }, tag) : null, /*#__PURE__*/React.createElement("h3", {
    style: {
      margin: 0,
      fontFamily: 'var(--font-core)',
      fontSize: '19px',
      fontWeight: 'var(--fw-semibold)',
      color: 'var(--ink-heading)'
    }
  }, name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--fs-metric)',
      fontWeight: 'var(--fw-bold)',
      color: 'var(--ink-heading)',
      margin: '10px 0 2px',
      lineHeight: 1
    }
  }, amount), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--fs-meta)',
      color: 'var(--muted)',
      marginBottom: '16px'
    }
  }, per), /*#__PURE__*/React.createElement("ul", {
    style: {
      listStyle: 'none',
      margin: 0,
      padding: 0,
      fontSize: 'var(--fs-body-sm)',
      color: 'var(--muted)',
      lineHeight: 2
    }
  }, features.map(x => /*#__PURE__*/React.createElement("li", {
    key: x
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--green-dark)',
      fontWeight: 'var(--fw-bold)'
    }
  }, "\u2713 "), x))), cta ? /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: '18px'
    }
  }, cta) : null);
}
Object.assign(__ds_scope, { PlanCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/marketing/PlanCard.jsx", error: String((e && e.message) || e) }); }

// components/marketing/SpecCard.jsx
try { (() => {
function SpecCard({
  title,
  value,
  children,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: '#fff',
      borderRadius: 'var(--radius-card)',
      boxShadow: 'var(--shadow-card)',
      padding: '20px 22px',
      ...style
    }
  }, /*#__PURE__*/React.createElement("b", {
    style: {
      display: 'block',
      color: 'var(--ink-heading)',
      fontSize: 'var(--fs-body)',
      marginBottom: '4px',
      fontFamily: 'var(--font-core)'
    }
  }, title), value ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--fs-meta)',
      color: 'var(--green-dark)',
      fontWeight: 'var(--fw-semibold)',
      marginBottom: '8px'
    }
  }, value) : null, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 'var(--fs-ui)',
      color: 'var(--muted)',
      lineHeight: 1.6
    }
  }, children));
}
Object.assign(__ds_scope, { SpecCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/marketing/SpecCard.jsx", error: String((e && e.message) || e) }); }

// components/marketing/Testimonial.jsx
try { (() => {
function Testimonial({
  meta,
  quote,
  who,
  result,
  todo,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: '#fff',
      borderRadius: 'var(--radius-card)',
      boxShadow: 'var(--shadow-card)',
      padding: 'var(--card-pad)',
      ...style
    }
  }, meta ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--fs-caption)',
      color: 'var(--green-dark)',
      fontWeight: 'var(--fw-semibold)',
      marginBottom: '10px',
      lineHeight: 1.5
    }
  }, meta, " ", todo ? /*#__PURE__*/React.createElement(__ds_scope.Badge, {
    tone: "amber",
    square: true
  }, todo) : null) : null, /*#__PURE__*/React.createElement("q", {
    style: {
      display: 'block',
      fontSize: '15.5px',
      color: 'var(--ink-heading)',
      lineHeight: 1.6,
      fontStyle: 'italic'
    }
  }, quote), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: '14px',
      fontSize: 'var(--fs-label)',
      fontWeight: 'var(--fw-semibold)',
      color: 'var(--ink-heading)'
    }
  }, who), result ? /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: '12px',
      paddingTop: '12px',
      borderTop: '1px solid var(--hairline)',
      fontSize: 'var(--fs-label)',
      color: 'var(--muted)'
    }
  }, /*#__PURE__*/React.createElement("b", {
    style: {
      color: 'var(--green-dark)'
    }
  }, "Resultaat:"), " ", result) : null);
}
Object.assign(__ds_scope, { Testimonial });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/marketing/Testimonial.jsx", error: String((e && e.message) || e) }); }

// components/marketing/TrustBar.jsx
try { (() => {
function TrustBar({
  items = [],
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: '#fff',
      borderRadius: 'var(--radius-card)',
      boxShadow: 'var(--shadow-card)',
      position: 'relative',
      zIndex: 5,
      maxWidth: '1180px',
      margin: '-44px auto 0',
      display: 'grid',
      gridTemplateColumns: 'repeat(' + items.length + ',1fr)',
      gap: '8px',
      padding: '22px 12px',
      ...style
    }
  }, items.map((it, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      textAlign: 'center',
      fontSize: 'var(--fs-label)',
      color: 'var(--muted)',
      padding: '0 10px',
      lineHeight: 1.4,
      borderRight: i === items.length - 1 ? 0 : '1px solid rgba(12,37,71,.08)'
    }
  }, /*#__PURE__*/React.createElement("b", {
    style: {
      display: 'block',
      color: 'var(--ink-heading)',
      fontSize: '15px'
    }
  }, it.value), it.label)));
}
Object.assign(__ds_scope, { TrustBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/marketing/TrustBar.jsx", error: String((e && e.message) || e) }); }

// components/navigation/PillTabs.jsx
try { (() => {
function PillTabs({
  items = [],
  active = 0,
  onChange,
  scroll = true,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: '10px',
      overflowX: scroll ? 'auto' : 'visible',
      paddingBottom: '2px',
      scrollbarWidth: 'none',
      ...style
    }
  }, items.map((it, i) => {
    const on = i === active;
    return /*#__PURE__*/React.createElement("button", {
      key: i,
      onClick: () => onChange && onChange(i),
      style: {
        flex: '0 0 auto',
        border: 0,
        cursor: 'pointer',
        borderRadius: 'var(--radius-pill)',
        padding: '14px 22px',
        fontFamily: 'var(--font-core)',
        fontSize: 'var(--fs-body)',
        fontWeight: 'var(--fw-bold)',
        background: on ? 'var(--navy-panel)' : 'var(--cream-2)',
        color: on ? '#fff' : 'var(--ink-heading)',
        transition: 'var(--dur-fast)',
        whiteSpace: 'nowrap'
      }
    }, it);
  }));
}
Object.assign(__ds_scope, { PillTabs });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/PillTabs.jsx", error: String((e && e.message) || e) }); }

// components/navigation/SiteFooter.jsx
try { (() => {
function SiteFooter({
  columns = [],
  legal = [],
  copyright = '© ExactCast AI',
  style
}) {
  return /*#__PURE__*/React.createElement("footer", {
    style: {
      background: 'var(--navy-panel)',
      color: '#fff',
      padding: '64px 0 28px',
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 'var(--max-width)',
      margin: '0 auto',
      padding: '0 var(--gutter)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1.2fr 1fr 1fr 1.2fr',
      gap: '36px'
    }
  }, columns.map((c, i) => /*#__PURE__*/React.createElement("div", {
    key: i
  }, /*#__PURE__*/React.createElement("h4", {
    style: {
      color: 'var(--green)',
      fontSize: '15px',
      margin: '0 0 16px',
      fontWeight: 'var(--fw-semibold)',
      fontFamily: 'var(--font-core)'
    }
  }, c.title), c.body ? /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--on-navy-soft)',
      fontSize: 'var(--fs-ui)',
      lineHeight: 2,
      margin: 0
    }
  }, c.body) : null, c.links ? /*#__PURE__*/React.createElement("ul", {
    style: {
      listStyle: 'none',
      margin: 0,
      padding: 0
    }
  }, c.links.map(l => /*#__PURE__*/React.createElement("li", {
    key: l
  }, /*#__PURE__*/React.createElement("a", {
    href: "#",
    style: {
      color: 'var(--on-navy-soft)',
      textDecoration: 'none',
      fontSize: 'var(--fs-ui)',
      lineHeight: 2
    }
  }, l)))) : null))), /*#__PURE__*/React.createElement("div", {
    style: {
      borderTop: '1px solid var(--rule-on-navy)',
      marginTop: '40px',
      paddingTop: '20px',
      fontSize: '13px',
      color: 'var(--on-navy-faint)',
      display: 'flex',
      gap: '22px',
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("span", null, copyright), legal.map(l => /*#__PURE__*/React.createElement("a", {
    key: l,
    href: "#",
    style: {
      color: 'var(--on-navy-faint)',
      textDecoration: 'none'
    }
  }, l)))));
}
Object.assign(__ds_scope, { SiteFooter });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/SiteFooter.jsx", error: String((e && e.message) || e) }); }

// components/navigation/SiteHeader.jsx
try { (() => {
function SiteHeader({
  links = [],
  active,
  phone,
  cta,
  onNav,
  style
}) {
  return /*#__PURE__*/React.createElement("header", {
    style: {
      position: 'absolute',
      inset: '0 0 auto 0',
      height: 'var(--header-h)',
      zIndex: 60,
      background: 'var(--navy-scrim)',
      backdropFilter: 'var(--blur-header)',
      WebkitBackdropFilter: 'var(--blur-header)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 'var(--max-width)',
      margin: '0 auto',
      padding: '0 var(--gutter)',
      height: 'var(--header-h)',
      display: 'flex',
      alignItems: 'center',
      gap: '24px'
    }
  }, /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => {
      e.preventDefault();
      onNav && onNav('home');
    },
    style: {
      textDecoration: 'none'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Wordmark, {
    pill: true,
    size: 19
  })), /*#__PURE__*/React.createElement("nav", {
    style: {
      display: 'flex',
      gap: '20px',
      marginLeft: 'auto',
      alignItems: 'center'
    }
  }, links.map(l => /*#__PURE__*/React.createElement("a", {
    key: l,
    href: "#",
    onClick: e => {
      e.preventDefault();
      onNav && onNav(l);
    },
    style: {
      color: '#fff',
      fontSize: 'var(--fs-nav)',
      textDecoration: 'none',
      opacity: l === active ? 1 : .92,
      whiteSpace: 'nowrap',
      borderBottom: l === active ? '2px solid var(--green)' : '0',
      paddingBottom: l === active ? '3px' : 0
    }
  }, l))), phone ? /*#__PURE__*/React.createElement("a", {
    href: 'tel:' + phone.replace(/\s/g, ''),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      color: '#fff',
      textDecoration: 'none',
      fontWeight: 'var(--fw-semibold)',
      fontSize: '15px',
      opacity: .92,
      whiteSpace: 'nowrap'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "phone",
    set: "lucide",
    size: 17
  }), phone) : null, cta ? /*#__PURE__*/React.createElement(__ds_scope.Button, {
    size: "sm",
    href: "#"
  }, cta) : null));
}
Object.assign(__ds_scope, { SiteHeader });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/SiteHeader.jsx", error: String((e && e.message) || e) }); }

// components/navigation/TabBar.jsx
try { (() => {
/* The tab bar is liquid glass: a translucent tint over a blurred, saturated backdrop.
   appearance="light" (default) | "dark" (iOS Dark Mode) | "opaque" (Reduce Transparency). */
const materials = {
  light: {
    background: 'var(--glass-tint)',
    backdropFilter: 'var(--glass-blur)',
    border: '1px solid var(--glass-edge)',
    boxShadow: 'var(--glass-shadow), inset 0 1px 0 var(--glass-hairline)',
    capsule: 'var(--glass-capsule)',
    idle: 'var(--app-tab-idle)',
    accent: 'var(--app-accent)'
  },
  dark: {
    background: 'var(--glass-tint-dark)',
    backdropFilter: 'var(--glass-blur)',
    border: '1px solid var(--glass-edge-dark)',
    boxShadow: 'var(--glass-shadow), inset 0 1px 0 var(--glass-hairline-dark)',
    capsule: 'var(--glass-capsule-dark)',
    idle: 'var(--app-tab-idle-dark)',
    accent: 'var(--app-accent-dark)'
  },
  opaque: {
    background: 'var(--glass-tint-opaque)',
    backdropFilter: 'none',
    border: '1px solid var(--glass-edge)',
    boxShadow: 'var(--glass-shadow)',
    capsule: 'var(--cream-2)',
    idle: 'var(--app-tab-idle-current)',
    accent: 'var(--app-accent-current)'
  }
};
function TabBar({
  items = [],
  active = 0,
  onChange,
  appearance = 'system',
  style
}) {
  /* appearance="system" follows the iOS setting through --app-accent-current /
     --app-tab-idle-current; "light"/"dark" pin the material explicitly. */
  const m = appearance === 'system' ? {
    ...materials.light,
    idle: 'var(--app-tab-idle-current)',
    accent: 'var(--app-accent-current)'
  } : materials[appearance] || materials.light;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '2px',
      borderRadius: 'var(--radius-pill)',
      padding: '8px 10px',
      background: m.background,
      backdropFilter: m.backdropFilter,
      WebkitBackdropFilter: m.backdropFilter,
      border: m.border,
      boxShadow: m.boxShadow,
      ...style
    }
  }, items.map((it, i) => {
    const on = i === active;
    return /*#__PURE__*/React.createElement("button", {
      key: i,
      onClick: () => onChange && onChange(i),
      style: {
        flex: 1,
        background: on ? m.capsule : 'transparent',
        border: 0,
        cursor: 'pointer',
        borderRadius: 'var(--radius-pill)',
        padding: '8px 4px 6px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '3px',
        color: on ? m.accent : m.idle,
        fontFamily: 'var(--font-core)',
        boxShadow: on && appearance !== 'opaque' ? '0 2px 8px -4px rgba(9,28,61,.35)' : 'none',
        transition: 'var(--dur-fast)'
      }
    }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
      name: it.icon,
      size: 24,
      weight: on ? 'fill' : 'regular'
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: '12px',
        fontWeight: on ? 'var(--fw-semibold)' : 'var(--fw-medium)'
      }
    }, it.label));
  }));
}
Object.assign(__ds_scope, { TabBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/TabBar.jsx", error: String((e && e.message) || e) }); }

// ui_kits/exactcast-ios/AppChrome.jsx
try { (() => {
const {
  Icon
} = window.ExactCastAIDesignSystem_6b62ae;
function StatusBar({
  time = '22:21',
  dark
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '14px 26px 2px',
      fontFamily: 'var(--font-core)',
      fontSize: '15px',
      fontWeight: 600,
      color: dark ? '#fff' : 'var(--ink-heading)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '5px'
    }
  }, time, /*#__PURE__*/React.createElement(Icon, {
    name: "moon",
    size: 13,
    weight: "fill"
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '6px'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "cell-signal-full",
    size: 15
  }), /*#__PURE__*/React.createElement(Icon, {
    name: "wifi-high",
    size: 15
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      border: '1.4px solid currentColor',
      borderRadius: '4px',
      padding: '1px 3px',
      fontSize: '10px',
      fontWeight: 700
    }
  }, "36")));
}

/* One bar on every screen: saved-location pills, a search field, and the settings button.
   A station-backed location shows its name in AgroExact green; a plain address stays navy. */
function LocationBar({
  locations,
  active,
  onPick,
  onSettings,
  onSearch,
  query,
  onQuery,
  searching,
  onCloseSearch
}) {
  if (searching) return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '6px 16px 12px',
      display: 'flex',
      gap: '10px',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0,
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      background: '#fff',
      borderRadius: 'var(--radius-pill)',
      padding: '12px 16px',
      boxShadow: 'var(--shadow-card)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--muted)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "magnifying-glass",
    size: 18
  })), /*#__PURE__*/React.createElement("input", {
    autoFocus: true,
    value: query,
    onChange: e => onQuery(e.target.value),
    placeholder: "Plaats of postcode",
    style: {
      flex: 1,
      border: 0,
      outline: 0,
      fontFamily: 'var(--font-core)',
      fontSize: 'var(--fs-body)',
      color: 'var(--ink-heading)',
      background: 'transparent'
    }
  })), /*#__PURE__*/React.createElement("button", {
    onClick: onCloseSearch,
    style: {
      border: 0,
      background: 'none',
      cursor: 'pointer',
      fontFamily: 'var(--font-core)',
      fontSize: 'var(--fs-body)',
      fontWeight: 600,
      color: 'var(--accent-dark)'
    }
  }, "Klaar"));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '6px 16px 12px',
      display: 'flex',
      gap: '8px',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0,
      display: 'flex',
      gap: '8px',
      overflowX: 'auto',
      scrollbarWidth: 'none'
    }
  }, locations.map((l, i) => {
    const on = i === active;
    return /*#__PURE__*/React.createElement("button", {
      key: l.name,
      onClick: () => onPick(i),
      style: {
        flex: '0 0 auto',
        border: 0,
        cursor: 'pointer',
        borderRadius: 'var(--radius-pill)',
        padding: '11px 18px',
        fontFamily: 'var(--font-core)',
        fontSize: 'var(--fs-body-sm)',
        fontWeight: 700,
        background: on ? '#fff' : 'rgba(255,255,255,.55)',
        color: on ? l.station ? 'var(--agro-ink)' : 'var(--ink-heading)' : 'var(--muted)',
        boxShadow: on ? 'var(--shadow-card)' : 'none',
        display: 'flex',
        alignItems: 'center',
        gap: '7px',
        transition: 'var(--dur-fast)',
        whiteSpace: 'nowrap'
      }
    }, l.station ? /*#__PURE__*/React.createElement("i", {
      style: {
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        background: 'var(--agro-bright)',
        flex: '0 0 8px'
      }
    }) : null, l.name);
  })), /*#__PURE__*/React.createElement("button", {
    onClick: onSearch,
    "aria-label": "Locatie zoeken",
    style: {
      width: '42px',
      height: '42px',
      flex: '0 0 42px',
      borderRadius: 'var(--radius-pill)',
      border: 0,
      cursor: 'pointer',
      background: 'var(--gradient-primary)',
      color: '#fff',
      display: 'grid',
      placeItems: 'center',
      boxShadow: 'var(--shadow-card)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "magnifying-glass",
    size: 19
  })), /*#__PURE__*/React.createElement("button", {
    onClick: onSettings,
    "aria-label": "Instellingen",
    style: {
      width: '42px',
      height: '42px',
      flex: '0 0 42px',
      borderRadius: 'var(--radius-pill)',
      border: 0,
      cursor: 'pointer',
      background: '#fff',
      color: 'var(--ink-heading)',
      display: 'grid',
      placeItems: 'center',
      boxShadow: 'var(--shadow-card)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "gear-six",
    size: 19
  })));
}

/* Weather condition glyph — Phosphor fill, tinted by daylight not by severity. */
const CONDITION = {
  clear: 'sun',
  night: 'moon-stars',
  cloudy: 'cloud',
  'partly-cloudy': 'cloud-sun',
  rain: 'cloud-rain',
  drizzle: 'cloud-rain',
  showers: 'cloud-rain',
  storm: 'cloud-lightning',
  wind: 'wind',
  fog: 'cloud-fog'
};
function WeatherIcon({
  cond,
  size = 34,
  style
}) {
  return /*#__PURE__*/React.createElement("span", {
    style: {
      color: cond === 'clear' ? 'var(--val-sun)' : cond === 'night' ? 'var(--accent)' : 'var(--muted)',
      ...style
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: CONDITION[cond] || 'cloud',
    size: size,
    weight: "fill"
  }));
}
function CardHeader({
  icon,
  label,
  action,
  onAction
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '2px 2px 12px'
    }
  }, icon ? /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--muted)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: icon,
    size: 16
  })) : null, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--fs-eyebrow)',
      fontWeight: 700,
      letterSpacing: 'var(--ls-eyebrow)',
      textTransform: 'uppercase',
      color: 'var(--muted)'
    }
  }, label), action ? /*#__PURE__*/React.createElement("button", {
    onClick: onAction,
    style: {
      marginLeft: 'auto',
      border: 0,
      background: 'none',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: '3px',
      fontFamily: 'var(--font-core)',
      fontSize: 'var(--fs-label)',
      fontWeight: 600,
      color: 'var(--accent-dark)'
    }
  }, action, /*#__PURE__*/React.createElement(Icon, {
    name: "caret-right",
    size: 13
  })) : null);
}

/* Arrow that points where the wind is going, from a compass bearing. */
function WindArrow({
  deg = 0,
  size = 15,
  style
}) {
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-block',
      transform: 'rotate(' + deg + 'deg)',
      color: 'var(--ink-heading)',
      ...style
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "arrow-up",
    size: size
  }));
}
Object.assign(window, {
  StatusBar,
  LocationBar,
  WeatherIcon,
  CardHeader,
  WindArrow,
  CONDITION
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/exactcast-ios/AppChrome.jsx", error: String((e && e.message) || e) }); }

// ui_kits/exactcast-ios/ForecastScreen.jsx
try { (() => {
const {
  Card,
  Icon
} = window.ExactCastAIDesignSystem_6b62ae;
const LAYERS = [['thermometer-simple', 'Temperatuur'], ['drop', 'Neerslag'], ['wind', 'Wind'], ['sun', 'Zon & verdamping'], ['drop-half', 'Vochtigheid']];
function ForecastScreen({
  loc
}) {
  const [layer, setLayer] = React.useState(1);
  const max = Math.max(...loc.hourly.map(h => h.mm), 1);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 16px 130px',
      display: 'grid',
      gridTemplateColumns: 'minmax(0,1fr)',
      gap: '14px'
    }
  }, /*#__PURE__*/React.createElement(Card, {
    radius: "var(--radius-app-card)",
    pad: "16px"
  }, /*#__PURE__*/React.createElement(CardHeader, {
    icon: "clock",
    label: "Detail korte termijn"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0,
      display: 'flex',
      gap: '6px',
      overflowX: 'auto',
      scrollbarWidth: 'none',
      paddingBottom: '4px'
    }
  }, loc.hourly.map((h, i) => /*#__PURE__*/React.createElement("div", {
    key: h.t,
    style: {
      flex: '0 0 74px',
      textAlign: 'center',
      borderRadius: '16px',
      padding: '12px 6px',
      background: i === 0 ? 'var(--sky-wash)' : 'transparent'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--fs-caption)',
      color: 'var(--muted)',
      fontWeight: 600
    }
  }, h.t), /*#__PURE__*/React.createElement("div", {
    style: {
      margin: '8px 0'
    }
  }, /*#__PURE__*/React.createElement(WeatherIcon, {
    cond: h.cond,
    size: 24
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--fs-body-sm)',
      fontWeight: 700,
      color: 'var(--val-temp)'
    }
  }, h.temp, "\xB0"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '12px',
      fontWeight: 700,
      marginTop: '4px',
      color: h.mm > 0 ? 'var(--val-precip)' : 'var(--val-precip-zero)'
    }
  }, h.mm.toFixed(1).replace('.', ','), /*#__PURE__*/React.createElement("i", {
    style: {
      fontSize: '10px',
      fontWeight: 600,
      fontStyle: 'normal',
      color: 'var(--muted)'
    }
  }, " mm")), /*#__PURE__*/React.createElement("div", {
    style: {
      height: '34px',
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'center',
      marginTop: '6px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: '18px',
      height: Math.max(3, h.mm / max * 34) + 'px',
      borderRadius: '4px',
      background: h.mm > 0 ? 'linear-gradient(180deg,var(--sky),var(--accent))' : 'rgba(12,37,71,.08)'
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '11.5px',
      color: 'var(--muted)',
      marginTop: '7px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '2px'
    }
  }, /*#__PURE__*/React.createElement(WindArrow, {
    deg: h.deg,
    size: 12
  }), h.wind), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '11.5px',
      fontWeight: 700,
      color: 'var(--val-sun)',
      marginTop: '5px'
    }
  }, h.sun, "m"))))), /*#__PURE__*/React.createElement(Card, {
    radius: "var(--radius-app-card)",
    pad: "16px"
  }, /*#__PURE__*/React.createElement(CardHeader, {
    icon: "calendar-blank",
    label: '14 dagen · ' + loc.model
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0,
      display: 'flex',
      gap: '8px',
      overflowX: 'auto',
      scrollbarWidth: 'none',
      paddingBottom: '10px'
    }
  }, LAYERS.map(([ic, l], i) => /*#__PURE__*/React.createElement("button", {
    key: l,
    onClick: () => setLayer(i),
    style: {
      flex: '0 0 auto',
      border: 0,
      cursor: 'pointer',
      borderRadius: 'var(--radius-pill)',
      padding: '9px 15px',
      fontFamily: 'var(--font-core)',
      fontSize: 'var(--fs-label)',
      fontWeight: 600,
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      whiteSpace: 'nowrap',
      transition: 'var(--dur-fast)',
      background: i === layer ? 'var(--gradient-primary)' : 'var(--cream-2)',
      color: i === layer ? '#fff' : 'var(--ink-heading)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: ic,
    size: 15
  }), l))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: '2px'
    }
  }, loc.daily.map(d => /*#__PURE__*/React.createElement(DayRow, {
    key: d.day + d.date,
    d: d,
    lo: loc.range.lo,
    hi: loc.range.hi
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--fs-caption)',
      color: 'var(--muted)',
      marginTop: '12px',
      lineHeight: 1.5
    }
  }, "Balken lopen van de dagminimum- naar de dagmaximumtemperatuur. Na dag 7 groeit de spreiding tussen de modelleden snel.")), /*#__PURE__*/React.createElement(Card, {
    radius: "var(--radius-app-card)",
    pad: "16px"
  }, /*#__PURE__*/React.createElement(CardHeader, {
    icon: "info",
    label: "Bron"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: '10px'
    }
  }, [['Korte termijn (0–2 uur)', 'ExactCast AI nowcast — radar' + (loc.station ? ' + AgroExact-station' : '')], ['2 uur – 48 uur', 'HARMONIE-AROME, per uur'], ['Dag 3–14', loc.model]].map(([a, b]) => /*#__PURE__*/React.createElement("div", {
    key: a,
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      gap: '14px',
      alignItems: 'baseline',
      paddingBottom: '8px',
      borderBottom: '1px solid var(--hairline-soft)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--fs-label)',
      color: 'var(--muted)'
    }
  }, a), /*#__PURE__*/React.createElement("b", {
    style: {
      fontSize: 'var(--fs-label)',
      color: 'var(--ink-heading)',
      textAlign: 'right'
    }
  }, b))))));
}
Object.assign(window, {
  ForecastScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/exactcast-ios/ForecastScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/exactcast-ios/NowcastScreen.jsx
try { (() => {
const {
  Card,
  Icon,
  StatusDot
} = window.ExactCastAIDesignSystem_6b62ae;

/* ---- 1. Summary hero — ONLY rendered when something significant is coming.
        Not rain-only: wind, storm or fog qualify too. No event, no hero. ---- */
function AlertHero({
  alert
}) {
  if (!alert) return null;
  const tone = alert.severity === 'heavy' ? 'var(--status-heavy)' : 'var(--accent-dark)';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--gradient-dark)',
      borderRadius: 'var(--radius-app-card)',
      padding: '20px 20px 18px',
      position: 'relative',
      overflow: 'hidden',
      boxShadow: 'var(--shadow-card)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      background: 'var(--gradient-sheen)',
      pointerEvents: 'none'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      color: 'var(--sky)',
      fontSize: 'var(--fs-eyebrow)',
      fontWeight: 700,
      letterSpacing: 'var(--ls-eyebrow)',
      textTransform: 'uppercase'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: alert.icon,
    size: 14,
    weight: "fill"
  }), alert.kind), /*#__PURE__*/React.createElement("div", {
    style: {
      color: '#fff',
      fontSize: '27px',
      fontWeight: 600,
      lineHeight: 1.2,
      marginTop: '10px'
    }
  }, alert.headline), /*#__PURE__*/React.createElement("div", {
    style: {
      color: 'var(--on-navy-body)',
      fontSize: 'var(--fs-body-sm)',
      lineHeight: 1.55,
      marginTop: '7px'
    }
  }, alert.sub), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: '6px',
      alignItems: 'flex-end',
      height: '56px',
      marginTop: '16px'
    }
  }, alert.bars.map((h, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      flex: 1,
      height: Math.max(4, h) + '%',
      borderRadius: '4px',
      background: h > 55 ? 'linear-gradient(180deg,var(--sky-soft),var(--sky))' : h > 18 ? 'rgba(143,220,245,.4)' : 'var(--track-on-navy)'
    }
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      color: 'var(--on-navy-muted)',
      fontSize: 'var(--fs-caption)',
      marginTop: '7px'
    }
  }, /*#__PURE__*/React.createElement("span", null, "nu"), /*#__PURE__*/React.createElement("span", null, "+30 min"), /*#__PURE__*/React.createElement("span", null, "+60 min"), /*#__PURE__*/React.createElement("span", null, "+2 uur"))));
}

/* ---- 2. Conditions hero — the chosen location's own measurements.
        Works for any address; a station-backed one adds the green source line. ---- */
function ConditionsHero({
  loc
}) {
  const cell = (label, children) => /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      textAlign: 'center',
      padding: '14px 8px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--fs-caption)',
      fontWeight: 700,
      letterSpacing: '.08em',
      textTransform: 'uppercase',
      color: 'var(--muted)',
      marginBottom: '6px'
    }
  }, label), children);
  return /*#__PURE__*/React.createElement(Card, {
    radius: "var(--radius-app-card)",
    pad: "0",
    style: {
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '18px 20px 16px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: '10px',
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      margin: 0,
      fontSize: '23px',
      fontWeight: 700,
      letterSpacing: '-.01em',
      color: loc.station ? 'var(--agro-ink)' : 'var(--ink-heading)'
    }
  }, loc.name), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--fs-label)',
      color: 'var(--muted)'
    }
  }, loc.time)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--fs-caption)',
      color: loc.station ? 'var(--agro-ink)' : 'var(--muted)',
      marginTop: '3px',
      display: 'flex',
      alignItems: 'center',
      gap: '6px'
    }
  }, loc.station ? /*#__PURE__*/React.createElement("i", {
    style: {
      width: '8px',
      height: '8px',
      borderRadius: '50%',
      background: 'var(--agro-bright)'
    }
  }) : null, loc.source), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '18px',
      marginTop: '14px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: '2px'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--val-high)',
      fontWeight: 700,
      fontSize: '19px'
    }
  }, "\u25B2 ", loc.hi, "\xB0"), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--val-low)',
      fontWeight: 700,
      fontSize: '19px'
    }
  }, "\u25BC ", loc.lo, "\xB0")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '58px',
      fontWeight: 800,
      color: 'var(--app-value)',
      lineHeight: 1,
      letterSpacing: '-.03em'
    }
  }, loc.temp, "\xB0"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginLeft: 'auto'
    }
  }, /*#__PURE__*/React.createElement(WeatherIcon, {
    cond: loc.cond,
    size: 54
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      borderTop: '1px solid var(--hairline)'
    }
  }, cell('Wind', /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '6px'
    }
  }, /*#__PURE__*/React.createElement(WindArrow, {
    deg: loc.wind.deg
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: '21px',
      fontWeight: 700,
      color: 'var(--val-wind)'
    }
  }, loc.wind.speed), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: '11.5px',
      fontWeight: 600,
      color: 'var(--muted)'
    }
  }, "km/u"))), /*#__PURE__*/React.createElement("div", {
    style: {
      width: '1px',
      background: 'var(--hairline)'
    }
  }), cell('Neerslag 24u', /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      justifyContent: 'center',
      gap: '5px'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: '21px',
      fontWeight: 700,
      color: loc.precip24 > 0 ? 'var(--val-precip)' : 'var(--val-precip-zero)'
    }
  }, String(loc.precip24).replace('.', ',')), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: '11.5px',
      fontWeight: 600,
      color: 'var(--muted)'
    }
  }, "mm"))), /*#__PURE__*/React.createElement("div", {
    style: {
      width: '1px',
      background: 'var(--hairline)'
    }
  }), cell('Vochtigheid', /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      justifyContent: 'center',
      gap: '4px'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: '21px',
      fontWeight: 700,
      color: 'var(--ink-heading)'
    }
  }, loc.humidity), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: '11.5px',
      fontWeight: 600,
      color: 'var(--muted)'
    }
  }, "%")))), /*#__PURE__*/React.createElement("div", {
    style: {
      borderTop: '1px solid var(--hairline)',
      padding: '4px 16px 10px'
    }
  }, loc.hourly.slice(0, 3).map(h => /*#__PURE__*/React.createElement(HourRow, {
    key: h.t,
    h: h
  }))));
}
function HourRow({
  h
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      padding: '9px 2px',
      fontWeight: 700,
      fontSize: 'var(--fs-body-sm)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--muted)',
      width: '46px'
    }
  }, h.t), /*#__PURE__*/React.createElement(WeatherIcon, {
    cond: h.cond,
    size: 19
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--val-temp)',
      width: '34px'
    }
  }, h.temp, "\xB0"), /*#__PURE__*/React.createElement("span", {
    style: {
      color: h.mm > 0 ? 'var(--val-precip)' : 'var(--val-precip-zero)',
      width: '58px'
    }
  }, h.mm.toFixed(1).replace('.', ','), /*#__PURE__*/React.createElement("i", {
    style: {
      fontSize: '11px',
      fontWeight: 600,
      fontStyle: 'normal',
      color: 'var(--muted)'
    }
  }, " mm")), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '4px',
      color: 'var(--val-wind)',
      marginLeft: 'auto'
    }
  }, /*#__PURE__*/React.createElement(WindArrow, {
    deg: h.deg,
    size: 13
  }), h.wind, /*#__PURE__*/React.createElement("i", {
    style: {
      fontSize: '11px',
      fontWeight: 600,
      fontStyle: 'normal',
      color: 'var(--muted)'
    }
  }, " km/u")), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--val-sun)',
      width: '34px',
      textAlign: 'right'
    }
  }, h.sun, /*#__PURE__*/React.createElement("i", {
    style: {
      fontSize: '11px',
      fontWeight: 600,
      fontStyle: 'normal'
    }
  }, "m")));
}

/* ---- 3. Radar preview — tap opens the Radar page ---- */
function RadarPreview({
  loc,
  onOpen
}) {
  return /*#__PURE__*/React.createElement(Card, {
    radius: "var(--radius-app-card)",
    pad: "16px"
  }, /*#__PURE__*/React.createElement(CardHeader, {
    icon: "broadcast",
    label: "Radar",
    action: "Volledig",
    onAction: onOpen
  }), /*#__PURE__*/React.createElement("div", {
    onClick: onOpen,
    style: {
      position: 'relative',
      borderRadius: '18px',
      overflow: 'hidden',
      height: '168px',
      cursor: 'pointer',
      background: 'linear-gradient(rgba(255,255,255,.5) 1px,transparent 1px) 0 0/100% 38px,linear-gradient(90deg,rgba(255,255,255,.5) 1px,transparent 1px) 0 0/38px 100%,linear-gradient(150deg,var(--map-land-1),var(--map-land-2) 60%,var(--map-land-3))'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: '44%',
      height: '14px',
      background: 'var(--map-water)',
      opacity: .85,
      transform: 'rotate(-5deg)'
    }
  }), [[28, 32, 110, .6], [56, 54, 140, .75]].map(([x, y, s, o], i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      position: 'absolute',
      left: x + '%',
      top: y + '%',
      width: s + 'px',
      height: s * .7 + 'px',
      transform: 'translate(-50%,-50%)',
      borderRadius: '50%',
      opacity: o,
      filter: 'blur(4px)',
      background: 'radial-gradient(closest-side,rgba(18,85,126,.8),rgba(95,208,242,.5) 60%,transparent)'
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: '42%',
      top: '56%',
      width: '21px',
      height: '21px',
      borderRadius: '50%',
      background: 'var(--ink-heading)',
      border: '3px solid #fff',
      transform: 'translate(-50%,-50%)',
      boxShadow: 'var(--shadow-pin)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: '-8px',
      borderRadius: '50%',
      border: '2px solid rgba(12,37,71,.35)',
      animation: 'ec-pulse 2.4s infinite'
    }
  })), loc.station ? [[66, 30]].map(([x, y], i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      position: 'absolute',
      left: x + '%',
      top: y + '%',
      width: '14px',
      height: '14px',
      borderRadius: '50%',
      background: '#fff',
      border: '3px solid var(--agro-bright)',
      transform: 'translate(-50%,-50%)',
      boxShadow: 'var(--shadow-pin)'
    }
  })) : null, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      right: '12px',
      top: '12px',
      background: 'rgba(255,255,255,.94)',
      borderRadius: 'var(--radius-pill)',
      padding: '6px 12px',
      fontSize: 'var(--fs-caption)',
      fontWeight: 700,
      color: 'var(--ink-heading)',
      boxShadow: 'var(--shadow-float)'
    }
  }, "nu \xB7 20:50")));
}

/* ---- 4. Forecast preview — tap opens the Verwachting page ---- */
function ForecastPreview({
  loc,
  onOpen
}) {
  const max = Math.max(...loc.hourly.map(h => h.mm), 1);
  return /*#__PURE__*/React.createElement(Card, {
    radius: "var(--radius-app-card)",
    pad: "16px"
  }, /*#__PURE__*/React.createElement(CardHeader, {
    icon: "clock",
    label: "Verwachting",
    action: "Details",
    onAction: onOpen
  }), /*#__PURE__*/React.createElement("div", {
    onClick: onOpen,
    style: {
      cursor: 'pointer',
      minWidth: 0,
      display: 'flex',
      gap: '6px',
      overflowX: 'auto',
      scrollbarWidth: 'none',
      paddingBottom: '4px'
    }
  }, loc.hourly.map((h, i) => /*#__PURE__*/React.createElement("div", {
    key: h.t,
    style: {
      flex: '0 0 62px',
      textAlign: 'center',
      borderRadius: '14px',
      padding: '10px 4px',
      background: i === 0 ? 'var(--sky-wash)' : 'transparent'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--fs-caption)',
      color: 'var(--muted)',
      fontWeight: 600
    }
  }, h.t), /*#__PURE__*/React.createElement("div", {
    style: {
      margin: '7px 0'
    }
  }, /*#__PURE__*/React.createElement(WeatherIcon, {
    cond: h.cond,
    size: 22
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--fs-body-sm)',
      fontWeight: 700,
      color: 'var(--val-temp)'
    }
  }, h.temp, "\xB0"), /*#__PURE__*/React.createElement("div", {
    style: {
      height: '30px',
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'center',
      marginTop: '6px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: '16px',
      height: Math.max(3, h.mm / max * 30) + 'px',
      borderRadius: '3px',
      background: h.mm > 0 ? 'linear-gradient(180deg,var(--sky),var(--accent))' : 'rgba(12,37,71,.08)'
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '11px',
      fontWeight: 700,
      marginTop: '5px',
      color: h.mm > 0 ? 'var(--val-precip)' : 'var(--val-precip-zero)'
    }
  }, h.mm.toFixed(1).replace('.', ','))))), /*#__PURE__*/React.createElement("div", {
    style: {
      borderTop: '1px solid var(--hairline)',
      marginTop: '12px',
      paddingTop: '12px',
      display: 'grid',
      gap: '2px'
    }
  }, loc.daily.slice(0, 4).map(d => /*#__PURE__*/React.createElement(DayRow, {
    key: d.day,
    d: d,
    lo: loc.range.lo,
    hi: loc.range.hi
  }))));
}
function DayRow({
  d,
  lo,
  hi
}) {
  const span = hi - lo || 1;
  const left = (d.lo - lo) / span * 100,
    width = (d.hi - d.lo) / span * 100;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      padding: '7px 2px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: '44px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--fs-label)',
      fontWeight: 700,
      color: 'var(--ink-heading)'
    }
  }, d.day), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '11px',
      color: 'var(--muted)'
    }
  }, d.date)), /*#__PURE__*/React.createElement(WeatherIcon, {
    cond: d.cond,
    size: 19
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--fs-label)',
      fontWeight: 700,
      color: 'var(--val-low)',
      width: '30px',
      textAlign: 'right'
    }
  }, d.lo, "\xB0"), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      height: '6px',
      borderRadius: '3px',
      background: 'rgba(12,37,71,.09)',
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("i", {
    style: {
      position: 'absolute',
      left: left + '%',
      width: width + '%',
      top: 0,
      bottom: 0,
      borderRadius: '3px',
      background: 'linear-gradient(90deg,var(--val-low),var(--val-temp))'
    }
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--fs-label)',
      fontWeight: 700,
      color: 'var(--val-high)',
      width: '30px'
    }
  }, d.hi, "\xB0"));
}
function NowcastScreen({
  loc,
  onOpenRadar,
  onOpenForecast
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 16px 130px',
      display: 'grid',
      gridTemplateColumns: 'minmax(0,1fr)',
      gap: '14px'
    }
  }, /*#__PURE__*/React.createElement(AlertHero, {
    alert: loc.alert
  }), /*#__PURE__*/React.createElement(ConditionsHero, {
    loc: loc
  }), /*#__PURE__*/React.createElement(RadarPreview, {
    loc: loc,
    onOpen: onOpenRadar
  }), /*#__PURE__*/React.createElement(ForecastPreview, {
    loc: loc,
    onOpen: onOpenForecast
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      justifyContent: 'center',
      fontSize: 'var(--fs-caption)',
      color: 'var(--muted)'
    }
  }, /*#__PURE__*/React.createElement(StatusDot, {
    status: "dry",
    size: 8
  }), " Vernieuwd om 20:50 \xB7 ", loc.model));
}
Object.assign(window, {
  NowcastScreen,
  AlertHero,
  ConditionsHero,
  RadarPreview,
  ForecastPreview,
  HourRow,
  DayRow
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/exactcast-ios/NowcastScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/exactcast-ios/RadarScreen.jsx
try { (() => {
const {
  Card,
  Icon,
  StatusDot
} = window.ExactCastAIDesignSystem_6b62ae;
function RadarScreen({
  loc
}) {
  const [t, setT] = React.useState(0);
  const [play, setPlay] = React.useState(false);
  React.useEffect(() => {
    if (!play) return;
    const id = setInterval(() => setT(v => (v + 1) % 9), 450);
    return () => clearInterval(id);
  }, [play]);
  const drift = t * 3.4;
  const blobs = [[26 + drift, 30, 120, .55], [54 + drift, 52, 152, .75], [70 + drift, 22, 92, .4]];
  const wet = t >= 2 && t <= 5;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 16px 130px',
      display: 'grid',
      gridTemplateColumns: 'minmax(0,1fr)',
      gap: '14px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      borderRadius: 'var(--radius-app-card)',
      overflow: 'hidden',
      aspectRatio: '3/4',
      boxShadow: 'var(--shadow-card)',
      background: 'linear-gradient(rgba(255,255,255,.5) 1px,transparent 1px) 0 0/100% 44px,linear-gradient(90deg,rgba(255,255,255,.5) 1px,transparent 1px) 0 0/44px 100%,linear-gradient(150deg,var(--map-land-1),var(--map-land-2) 60%,var(--map-land-3))'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: '38%',
      height: '16px',
      background: 'var(--map-water)',
      opacity: .85,
      transform: 'rotate(-6deg)'
    }
  }), blobs.map(([x, y, s, o], i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      position: 'absolute',
      left: x + '%',
      top: y + '%',
      width: s + 'px',
      height: s * .7 + 'px',
      transform: 'translate(-50%,-50%)',
      borderRadius: '50%',
      opacity: o,
      transition: 'left .4s linear',
      background: 'radial-gradient(closest-side,rgba(18,85,126,.85),rgba(95,208,242,.5) 60%,transparent)',
      filter: 'blur(4px)'
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: '42%',
      top: '56%',
      width: '23px',
      height: '23px',
      borderRadius: '50%',
      background: 'var(--ink-heading)',
      border: '3px solid #fff',
      transform: 'translate(-50%,-50%)',
      boxShadow: 'var(--shadow-pin)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: '-9px',
      borderRadius: '50%',
      border: '2px solid rgba(12,37,71,.35)',
      animation: 'ec-pulse 2.4s infinite'
    }
  })), [[66, 30], [24, 68], [78, 74]].map(([x, y], i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      position: 'absolute',
      left: x + '%',
      top: y + '%',
      width: '15px',
      height: '15px',
      borderRadius: '50%',
      background: '#fff',
      border: '3px solid var(--agro-bright)',
      transform: 'translate(-50%,-50%)',
      boxShadow: 'var(--shadow-pin)'
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: '14px',
      bottom: '14px',
      background: 'rgba(255,255,255,.94)',
      borderRadius: '12px',
      padding: '9px 13px',
      fontSize: 'var(--fs-caption)',
      color: 'var(--ink-heading)',
      boxShadow: 'var(--shadow-float)',
      display: 'grid',
      gap: '6px'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '6px'
    }
  }, /*#__PURE__*/React.createElement("i", {
    style: {
      width: '10px',
      height: '10px',
      borderRadius: '50%',
      background: 'var(--ink-heading)',
      border: '2px solid #fff',
      boxShadow: '0 0 0 1px var(--ink-heading)'
    }
  }), "Jouw locatie"), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      color: 'var(--agro-ink)',
      fontWeight: 600
    }
  }, /*#__PURE__*/React.createElement("i", {
    style: {
      width: '10px',
      height: '10px',
      borderRadius: '50%',
      background: '#fff',
      border: '3px solid var(--agro-bright)'
    }
  }), "AgroExact-station")), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      right: '14px',
      top: '14px',
      background: 'rgba(255,255,255,.94)',
      borderRadius: 'var(--radius-pill)',
      padding: '8px 14px',
      fontSize: 'var(--fs-caption)',
      fontWeight: 700,
      color: 'var(--ink-heading)',
      boxShadow: 'var(--shadow-float)'
    }
  }, t === 0 ? 'nu' : '+' + t * 15 + ' min'), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: '14px',
      top: '14px',
      display: 'grid',
      gap: '8px'
    }
  }, ['plus', 'minus', 'crosshair'].map(n => /*#__PURE__*/React.createElement("button", {
    key: n,
    "aria-label": n,
    style: {
      width: '36px',
      height: '36px',
      borderRadius: '12px',
      border: 0,
      background: 'rgba(255,255,255,.94)',
      color: 'var(--ink-heading)',
      boxShadow: 'var(--shadow-float)',
      cursor: 'pointer',
      display: 'grid',
      placeItems: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: n,
    size: 17
  }))))), /*#__PURE__*/React.createElement(Card, {
    radius: "var(--radius-app-card)",
    pad: "16px"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px'
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setPlay(p => !p),
    "aria-label": "Animatie",
    style: {
      width: '42px',
      height: '42px',
      flex: '0 0 42px',
      borderRadius: 'var(--radius-pill)',
      border: 0,
      cursor: 'pointer',
      background: 'var(--gradient-primary)',
      color: '#fff',
      display: 'grid',
      placeItems: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: play ? 'pause' : 'play',
    size: 18,
    weight: "fill"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: 'var(--fs-caption)',
      color: 'var(--muted)',
      marginBottom: '4px'
    }
  }, /*#__PURE__*/React.createElement("span", null, "nu"), /*#__PURE__*/React.createElement("span", null, "+1 uur"), /*#__PURE__*/React.createElement("span", null, "+2 uur")), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "0",
    max: "8",
    value: t,
    onChange: e => setT(+e.target.value),
    style: {
      width: '100%'
    }
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      marginTop: '14px',
      fontSize: 'var(--fs-body-sm)',
      color: 'var(--ink-heading)',
      fontWeight: 600
    }
  }, /*#__PURE__*/React.createElement(StatusDot, {
    status: wet ? 'heavy' : 'dry',
    size: 10
  }), wet ? 'Bui trekt over ' + loc.name + ' — ' + loc.alertMm + ' mm verwacht' : 'Droog op ' + loc.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--fs-caption)',
      color: 'var(--muted)',
      marginTop: '7px',
      lineHeight: 1.5
    }
  }, "Nowcast uit radarbeelden", loc.station ? ' en ' + loc.stations + ' AgroExact-stations om je heen' : '', ". Zekerheid ", loc.confidence, "%.")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      justifyContent: 'center',
      fontSize: 'var(--fs-caption)',
      color: 'var(--muted)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "arrows-clockwise",
    size: 13
  }), " Elke 5 minuten vernieuwd"));
}
Object.assign(window, {
  RadarScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/exactcast-ios/RadarScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/exactcast-ios/SettingsScreen.jsx
try { (() => {
const {
  Card,
  Icon,
  Button
} = window.ExactCastAIDesignSystem_6b62ae;
function Group({
  label,
  children
}) {
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--fs-eyebrow)',
      fontWeight: 700,
      letterSpacing: 'var(--ls-eyebrow)',
      textTransform: 'uppercase',
      color: 'var(--muted)',
      padding: '0 6px 8px'
    }
  }, label), /*#__PURE__*/React.createElement(Card, {
    radius: "var(--radius-app-card)",
    pad: "0",
    style: {
      overflow: 'hidden'
    }
  }, children));
}
function Row({
  icon,
  label,
  hint,
  children,
  last
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '14px 16px',
      borderBottom: last ? 0 : '1px solid var(--hairline-soft)'
    }
  }, icon ? /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--muted)',
      flex: '0 0 20px'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: icon,
    size: 20
  })) : null, /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--fs-body-sm)',
      fontWeight: 600,
      color: 'var(--ink-heading)'
    }
  }, label), hint ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--fs-caption)',
      color: 'var(--muted)',
      lineHeight: 1.45,
      marginTop: '2px'
    }
  }, hint) : null), /*#__PURE__*/React.createElement("div", {
    style: {
      marginLeft: 'auto',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      flex: '0 0 auto'
    }
  }, children));
}
function Segmented({
  options,
  value,
  onChange,
  compact
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: '3px',
      background: 'var(--cream-2)',
      borderRadius: 'var(--radius-pill)',
      padding: '3px'
    }
  }, options.map(o => {
    const on = o === value;
    return /*#__PURE__*/React.createElement("button", {
      key: o,
      onClick: () => onChange(o),
      style: {
        border: 0,
        cursor: 'pointer',
        borderRadius: 'var(--radius-pill)',
        padding: compact ? '6px 11px' : '7px 14px',
        fontFamily: 'var(--font-core)',
        fontSize: compact ? '12.5px' : 'var(--fs-label)',
        fontWeight: 600,
        transition: 'var(--dur-fast)',
        whiteSpace: 'nowrap',
        background: on ? '#fff' : 'transparent',
        color: on ? 'var(--accent-dark)' : 'var(--muted)',
        boxShadow: on ? '0 2px 8px -4px rgba(9,28,61,.3)' : 'none'
      }
    }, o);
  }));
}
function Toggle({
  on,
  onChange
}) {
  return /*#__PURE__*/React.createElement("button", {
    onClick: () => onChange(!on),
    role: "switch",
    "aria-checked": on,
    style: {
      width: '50px',
      height: '30px',
      borderRadius: 'var(--radius-pill)',
      border: 0,
      cursor: 'pointer',
      padding: '3px',
      background: on ? 'var(--gradient-primary)' : 'rgba(12,37,71,.18)',
      display: 'flex',
      justifyContent: on ? 'flex-end' : 'flex-start',
      transition: 'var(--dur-fast)'
    }
  }, /*#__PURE__*/React.createElement("i", {
    style: {
      width: '24px',
      height: '24px',
      borderRadius: '50%',
      background: '#fff',
      boxShadow: 'var(--shadow-float)',
      display: 'block'
    }
  }));
}
function SettingsScreen({
  state,
  set,
  locations,
  onReorder,
  onRemove,
  onAddLocation
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 16px 130px',
      display: 'grid',
      gridTemplateColumns: 'minmax(0,1fr)',
      gap: '18px'
    }
  }, /*#__PURE__*/React.createElement(Group, {
    label: "Weergave"
  }, /*#__PURE__*/React.createElement(Row, {
    icon: "translate",
    label: "Taal",
    hint: "Overschrijft de systeemtaal van je telefoon"
  }, /*#__PURE__*/React.createElement(Segmented, {
    compact: true,
    options: ['NL', 'DE', 'EN'],
    value: state.lang,
    onChange: v => set('lang', v)
  })), /*#__PURE__*/React.createElement(Row, {
    icon: "text-aa",
    label: "Tekstgrootte",
    hint: "Overschrijft de systeeminstelling"
  }, /*#__PURE__*/React.createElement(Segmented, {
    compact: true,
    options: ['A', 'A+', 'A++'],
    value: state.fontSize,
    onChange: v => set('fontSize', v)
  })), /*#__PURE__*/React.createElement(Row, {
    icon: "circle-half",
    label: "Thema",
    hint: "Automatisch volgt de instelling van iOS",
    last: true
  }, /*#__PURE__*/React.createElement(Segmented, {
    compact: true,
    options: ['Licht', 'Donker', 'Auto'],
    value: state.theme,
    onChange: v => set('theme', v)
  }))), /*#__PURE__*/React.createElement(Group, {
    label: "Mijn locaties"
  }, locations.map((l, i) => /*#__PURE__*/React.createElement(Row, {
    key: l.name,
    icon: "dots-six-vertical",
    label: /*#__PURE__*/React.createElement("span", {
      style: {
        color: l.station ? 'var(--agro-ink)' : 'var(--ink-heading)'
      }
    }, l.name),
    hint: l.source,
    last: i === locations.length - 1
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => onReorder(i, -1),
    disabled: i === 0,
    "aria-label": "Omhoog",
    style: {
      border: 0,
      background: 'none',
      cursor: 'pointer',
      color: i === 0 ? 'var(--ink-disabled)' : 'var(--muted)',
      display: 'grid',
      placeItems: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "arrow-up",
    size: 17
  })), /*#__PURE__*/React.createElement("button", {
    onClick: () => onReorder(i, 1),
    disabled: i === locations.length - 1,
    "aria-label": "Omlaag",
    style: {
      border: 0,
      background: 'none',
      cursor: 'pointer',
      color: i === locations.length - 1 ? 'var(--ink-disabled)' : 'var(--muted)',
      display: 'grid',
      placeItems: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "arrow-down",
    size: 17
  })), /*#__PURE__*/React.createElement("button", {
    onClick: () => onRemove(i),
    "aria-label": "Verwijderen",
    style: {
      border: 0,
      background: 'none',
      cursor: 'pointer',
      color: 'var(--status-red)',
      display: 'grid',
      placeItems: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "trash",
    size: 17
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '14px 16px',
      borderTop: '1px solid var(--hairline-soft)'
    }
  }, /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    onClick: onAddLocation
  }, "Locatie toevoegen"))), /*#__PURE__*/React.createElement(Group, {
    label: "Integraties"
  }, /*#__PURE__*/React.createElement(Row, {
    icon: "plugs-connected",
    label: /*#__PURE__*/React.createElement("span", null, "Verbinden met ", /*#__PURE__*/React.createElement("b", {
      style: {
        color: 'var(--agro-ink)'
      }
    }, "AgroExact")),
    hint: state.agro ? 'Verbonden · 2 eigen stations, 6 in de buurt' : 'Koppel je eigen weerstation of regenmeter',
    last: true
  }, /*#__PURE__*/React.createElement(Toggle, {
    on: state.agro,
    onChange: v => set('agro', v)
  }))), /*#__PURE__*/React.createElement(Group, {
    label: "Weermodel"
  }, /*#__PURE__*/React.createElement(Row, {
    icon: "broadcast",
    label: "Korte termijn",
    hint: "0\u20132 uur, elke 5 minuten"
  }, /*#__PURE__*/React.createElement(Segmented, {
    compact: true,
    options: ['Nowcast', 'Radar'],
    value: state.shortModel,
    onChange: v => set('shortModel', v)
  })), /*#__PURE__*/React.createElement(Row, {
    icon: "cloud-sun",
    label: "Middellange termijn",
    hint: "Dag 3 tot 14"
  }, /*#__PURE__*/React.createElement(Segmented, {
    compact: true,
    options: ['ECMWF', 'GFS', 'Mix'],
    value: state.model,
    onChange: v => set('model', v)
  })), /*#__PURE__*/React.createElement(Row, {
    icon: "chart-line",
    label: "Spreiding tonen",
    hint: "Toont de onzekerheid tussen de modelleden"
  }, /*#__PURE__*/React.createElement(Toggle, {
    on: state.spread,
    onChange: v => set('spread', v)
  })), /*#__PURE__*/React.createElement(Row, {
    icon: "ruler",
    label: "Eenheden",
    hint: "Neerslag in mm, wind in km/u",
    last: true
  }, /*#__PURE__*/React.createElement(Segmented, {
    compact: true,
    options: ['km/u', 'm/s', 'Bft'],
    value: state.windUnit,
    onChange: v => set('windUnit', v)
  }))), /*#__PURE__*/React.createElement(Group, {
    label: "Meldingen"
  }, /*#__PURE__*/React.createElement(Row, {
    icon: "cloud-rain",
    label: "Regen op mijn locatie",
    hint: "Uiterlijk 20 minuten vooraf"
  }, /*#__PURE__*/React.createElement(Toggle, {
    on: state.notifyRain,
    onChange: v => set('notifyRain', v)
  })), /*#__PURE__*/React.createElement(Row, {
    icon: "wind",
    label: "Harde wind",
    hint: "Vanaf windstoten boven 60 km/u"
  }, /*#__PURE__*/React.createElement(Toggle, {
    on: state.notifyWind,
    onChange: v => set('notifyWind', v)
  })), /*#__PURE__*/React.createElement(Row, {
    icon: "thermometer-simple",
    label: "Vorst",
    hint: "Wanneer de temperatuur onder 0 \xB0C duikt"
  }, /*#__PURE__*/React.createElement(Toggle, {
    on: state.notifyFrost,
    onChange: v => set('notifyFrost', v)
  })), /*#__PURE__*/React.createElement(Row, {
    icon: "moon",
    label: "Niet storen",
    hint: "Geen meldingen tussen 22:00 en 07:00",
    last: true
  }, /*#__PURE__*/React.createElement(Toggle, {
    on: state.quiet,
    onChange: v => set('quiet', v)
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--fs-caption)',
      color: 'var(--muted)',
      textAlign: 'center',
      lineHeight: 1.5
    }
  }, "ExactCast AI \xB7 versie 0.9 (iOS) \xB7 Android volgt"));
}
Object.assign(window, {
  SettingsScreen,
  Toggle,
  Segmented
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/exactcast-ios/SettingsScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/exactcast-web/HeroSection.jsx
try { (() => {
const {
  Button,
  Icon,
  TrustBar,
  PhoneMock,
  MeasurementRow,
  StatusDot
} = window.ExactCastAIDesignSystem_6b62ae;
function Hero({
  onNav
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--gradient-dark)',
      borderRadius: 'var(--radius-hero)',
      padding: '168px 0 96px',
      position: 'relative',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      background: 'var(--gradient-sheen)',
      pointerEvents: 'none'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      zIndex: 2,
      maxWidth: 'var(--max-width)',
      margin: '0 auto',
      padding: '0 var(--gutter)',
      display: 'grid',
      gridTemplateColumns: '1.05fr .95fr',
      gap: '56px',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: 0,
      fontSize: 'var(--fs-h1)',
      lineHeight: 'var(--lh-h1)',
      fontWeight: 600,
      color: '#fff'
    }
  }, "Weet of het bij ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--green)'
    }
  }, "jouw straat"), " gaat regenen, niet bij het vliegveld"), /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--on-navy-body)',
      fontSize: 'var(--fs-lead)',
      lineHeight: 'var(--lh-lead)',
      maxWidth: '36em',
      marginTop: '18px'
    }
  }, "ExactCast AI leest de radar \xE9n de weerstations van AgroExact bij jou in de buurt. Elke vijf minuten een nieuwe voorspelling voor de komende twee uur \u2014 op jouw adres, niet op je provincie."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: '14px',
      flexWrap: 'wrap',
      marginTop: '32px'
    }
  }, /*#__PURE__*/React.createElement(Button, {
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "arrow-right",
      set: "lucide",
      size: 20
    }),
    onClick: () => onNav('Netwerk')
  }, "Kijk wie er bij jou meet"), /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    onClick: () => onNav('Prijzen')
  }, "Wat kost het?")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      marginTop: '22px',
      color: 'var(--on-navy-muted)',
      fontSize: 'var(--fs-caption)'
    }
  }, /*#__PURE__*/React.createElement(StatusDot, {
    status: "green",
    size: 8
  }), " Nu in de App Store \xB7 Android volgt")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'flex-end',
      gap: '18px'
    }
  }, /*#__PURE__*/React.createElement(PhoneMock, {
    small: true,
    title: "Actueel"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: '6px'
    }
  }, [['Neerslag nu', '0,4 mm'], ['Temperatuur', '20 °C'], ['Wind', '3,9 m/s']].map(([a, b]) => /*#__PURE__*/React.createElement("div", {
    key: a,
    style: {
      background: '#fff',
      borderRadius: '12px',
      padding: '8px 10px',
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: '10.5px',
      color: 'var(--ink-heading)',
      fontWeight: 600,
      boxShadow: 'var(--shadow-card)'
    }
  }, /*#__PURE__*/React.createElement("span", null, a), /*#__PURE__*/React.createElement("span", null, b))))), /*#__PURE__*/React.createElement(PhoneMock, {
    title: "Nowcast"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: '6px'
    }
  }, /*#__PURE__*/React.createElement(MeasurementRow, {
    compact: true,
    status: "red",
    name: "Thuis",
    meta: "regen in 20 min",
    advice: "4,2 mm"
  }), /*#__PURE__*/React.createElement(MeasurementRow, {
    compact: true,
    status: "amber",
    name: "Volkspark",
    meta: "koers onzeker",
    advice: "Twijfel"
  }), /*#__PURE__*/React.createElement(MeasurementRow, {
    compact: true,
    status: "green",
    name: "Camping De Es",
    meta: "droog tot morgen",
    advice: "0 mm"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '9.5px',
      color: 'var(--muted)',
      marginTop: '6px',
      lineHeight: 1.4
    }
  }, "Gebaseerd op het station 1,2 km van je adres. Vernieuwd om 20:50."))))));
}
function HeroTrust() {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 'var(--max-width)',
      margin: '0 auto',
      padding: '0 var(--gutter)'
    }
  }, /*#__PURE__*/React.createElement(TrustBar, {
    items: [{
      value: '1.240 meetpunten',
      label: 'in Nederland en Duitsland'
    }, {
      value: 'elke 5 minuten',
      label: 'een nieuwe nowcast'
    }, {
      value: '2 uur vooruit',
      label: 'per 5 minuten, op jouw adres'
    }, {
      value: 'Gratis te proberen',
      label: 'je hebt geen eigen station nodig'
    }]
  }));
}
Object.assign(window, {
  Hero,
  HeroTrust
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/exactcast-web/HeroSection.jsx", error: String((e && e.message) || e) }); }

// ui_kits/exactcast-web/HomePage.jsx
try { (() => {
const {
  SectionHeading,
  Card,
  Button,
  LinkArrow,
  Icon,
  StatusCard,
  ComparisonTable,
  Callout,
  Accordion,
  CtaBand,
  SpecCard,
  Testimonial,
  StatTile
} = window.ExactCastAIDesignSystem_6b62ae;
function Section({
  alt,
  children,
  id
}) {
  return /*#__PURE__*/React.createElement("section", {
    id: id,
    style: {
      padding: 'var(--section-y) 0',
      background: alt ? 'var(--cream-2)' : 'transparent'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 'var(--max-width)',
      margin: '0 auto',
      padding: '0 var(--gutter)'
    }
  }, children));
}
function HomePage({
  onNav
}) {
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Hero, {
    onNav: onNav
  }), /*#__PURE__*/React.createElement(HeroTrust, null), /*#__PURE__*/React.createElement(Section, null, /*#__PURE__*/React.createElement(SectionHeading, {
    eyebrow: "Waarvoor gebruik je het",
    title: "Drie vragen die je 's ochtends stelt",
    lead: "Niet 'wordt het een mooie dag', maar 'kan ik n\xFA de was buiten hangen'."
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3,1fr)',
      gap: '24px',
      marginTop: '40px'
    }
  }, [['Kan de was buiten?', 'Je ziet of er in de komende twee uur neerslag op jouw adres valt, en hoeveel. Niet de kans voor de hele regio, maar het beeld boven je straat.'], ['Haal ik het op de fiets?', 'Per vijf minuten zie je waar de bui is en welke kant hij op gaat. Vijftien minuten wachten is vaak genoeg.'], ['Moet ik de tuin sproeien?', 'ExactCast telt de neerslag die echt op jouw locatie gemeten is. Een landelijk gemiddelde zegt daar weinig over.']].map(([t, b]) => /*#__PURE__*/React.createElement(Card, {
    key: t
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      margin: '0 0 10px',
      fontSize: '18px',
      fontWeight: 600,
      color: 'var(--ink-heading)'
    }
  }, t), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 'var(--fs-body-sm)',
      color: 'var(--muted)',
      lineHeight: 1.6
    }
  }, b))))), /*#__PURE__*/React.createElement(Section, {
    alt: true,
    id: "hoe"
  }, /*#__PURE__*/React.createElement(SectionHeading, {
    eyebrow: "Hoe het werkt",
    title: "Radar vertelt waar de bui is. Stations vertellen wat er echt viel.",
    lead: "ExactCast AI legt die twee over elkaar en corrigeert het radarbeeld met de metingen van de stations om je heen."
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3,1fr)',
      gap: '24px',
      marginTop: '44px'
    }
  }, [['Radarbeeld', 'Elke vijf minuten een nieuw beeld van waar het regent en hoe hard, op ongeveer één kilometer.'], ['Echte metingen', 'De regenmeters en weerstations van het AgroExact-netwerk meten per tien minuten wat er daadwerkelijk valt.'], ['Het model erbovenop', 'Het AI-model leert het verschil tussen radar en meting en verplaatst de bui vooruit — twee uur, per vijf minuten.']].map(([t, b], i) => /*#__PURE__*/React.createElement("div", {
    key: t,
    style: {
      position: 'relative',
      paddingTop: '34px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: '34px',
      height: '34px',
      borderRadius: '50%',
      background: 'var(--gradient-primary)',
      color: '#fff',
      fontWeight: 700,
      display: 'grid',
      placeItems: 'center',
      fontSize: '15px'
    }
  }, i + 1), /*#__PURE__*/React.createElement("h3", {
    style: {
      margin: '14px 0 8px',
      fontSize: 'var(--fs-h3)',
      fontWeight: 600,
      color: 'var(--ink-heading)'
    }
  }, t), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 'var(--fs-body-sm)',
      color: 'var(--muted)',
      lineHeight: 1.6
    }
  }, b)))), /*#__PURE__*/React.createElement(Callout, {
    title: "Wat 'nowcasting' betekent",
    style: {
      marginTop: '36px'
    }
  }, "Een nowcast is een voorspelling voor de eerste paar uur, gemaakt uit metingen in plaats van uit een weermodel. Daardoor is hij op korte termijn scherper \u2014 en na twee uur juist minder betrouwbaar. Vanaf dat punt laten we het gewone weerbericht zien.")), /*#__PURE__*/React.createElement(Section, null, /*#__PURE__*/React.createElement(SectionHeading, {
    eyebrow: "Eerlijk vergelijken",
    title: "Wat je elders krijgt, en wat hier anders is"
  }), /*#__PURE__*/React.createElement(ComparisonTable, {
    style: {
      marginTop: '36px'
    },
    columns: ['Gratis weerapp', 'Landelijke buienradar', 'ExactCast AI'],
    rows: [{
      label: 'Bron',
      cells: ['Weermodel op ~10 km', 'Radar op ~1 km', 'Radar + gemeten neerslag naast je deur']
    }, {
      label: 'Vooruit kijken',
      cells: ['Uren, grof', 'Circa 1 uur', '2 uur, per 5 minuten']
    }, {
      label: 'Echte meting van jouw plek',
      cells: ['—', '—', 'Ja, uit het AgroExact-netwerk']
    }, {
      label: 'Zegt hoe zeker het is',
      cells: ['—', '—', 'Ja, per nowcast']
    }, {
      label: 'Eigen weerstation nodig',
      cells: ['Nee', 'Nee', 'Nee']
    }]
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3,1fr)',
      gap: '20px',
      marginTop: '36px'
    }
  }, /*#__PURE__*/React.createElement(StatusCard, {
    status: "green",
    title: "Groen \u2014 droog"
  }, "Geen neerslag in de komende twee uur. Ga je gang."), /*#__PURE__*/React.createElement(StatusCard, {
    status: "amber",
    title: "Amber \u2014 twijfel"
  }, "Een bui in de buurt, de koers is nog onzeker. Kijk over een half uur opnieuw."), /*#__PURE__*/React.createElement(StatusCard, {
    status: "red",
    title: "Rood \u2014 regen"
  }, "Neerslag binnen twee uur op jouw adres, met tijd en hoeveelheid."))), /*#__PURE__*/React.createElement(Section, {
    alt: true
  }, /*#__PURE__*/React.createElement(SectionHeading, {
    eyebrow: "Het netwerk",
    title: "Je leunt op de stations van de mensen om je heen",
    lead: "Boeren en tuinders in Nederland en Duitsland meten al jaren op hun eigen grond. Die metingen maken jouw voorspelling scherper \u2014 en je hoeft er zelf niets voor te plaatsen."
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '.9fr 1.1fr',
      gap: '40px',
      marginTop: '40px',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3,1fr)',
      gap: '14px'
    }
  }, /*#__PURE__*/React.createElement(StatTile, {
    value: "1.240",
    label: "meetpunten"
  }), /*#__PURE__*/React.createElement(StatTile, {
    value: "10 min",
    label: "meetinterval"
  }), /*#__PURE__*/React.createElement(StatTile, {
    value: "4,3 km",
    label: "mediane afstand"
  })), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 'var(--fs-body-sm)',
      color: 'var(--muted)',
      lineHeight: 1.6,
      marginTop: '20px'
    }
  }, "Hoe dichter het naaste station bij je staat, hoe beter de nowcast klopt. In de app zie je precies welk station voor jou gebruikt wordt en hoe ver dat is."), /*#__PURE__*/React.createElement(LinkArrow, {
    onClick: e => {
      e.preventDefault();
      onNav('Netwerk');
    }
  }, "Kijk wie er bij jou in de buurt meet")), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      aspectRatio: '4/3',
      borderRadius: 'var(--radius-card)',
      overflow: 'hidden',
      boxShadow: 'var(--shadow-card)',
      background: 'linear-gradient(rgba(255,255,255,.5) 1px,transparent 1px) 0 0/100% 44px,linear-gradient(90deg,rgba(255,255,255,.5) 1px,transparent 1px) 0 0/44px 100%,linear-gradient(150deg,var(--map-land-1),var(--map-land-2) 60%,var(--map-land-3))'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: '42%',
      height: '18px',
      background: 'var(--map-water)',
      opacity: .85,
      transform: 'rotate(-4deg)'
    }
  }), [[30, 34], [52, 58], [68, 28], [44, 74], [76, 62], [22, 62]].map(([x, y], i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      position: 'absolute',
      left: x + '%',
      top: y + '%',
      width: '15px',
      height: '15px',
      borderRadius: '50%',
      background: '#fff',
      border: '3px solid var(--green-dark)',
      transform: 'translate(-50%,-50%)',
      boxShadow: 'var(--shadow-pin)'
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: '40%',
      top: '48%',
      width: '23px',
      height: '23px',
      borderRadius: '50%',
      background: 'var(--ink-heading)',
      border: '3px solid #fff',
      transform: 'translate(-50%,-50%)',
      boxShadow: 'var(--shadow-pin)',
      zIndex: 3
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: '-9px',
      borderRadius: '50%',
      border: '2px solid rgba(12,37,71,.35)',
      animation: 'ec-pulse 2.4s infinite'
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: '14px',
      bottom: '14px',
      background: 'rgba(255,255,255,.94)',
      borderRadius: '10px',
      padding: '9px 13px',
      fontSize: 'var(--fs-caption)',
      color: 'var(--ink-heading)',
      boxShadow: 'var(--shadow-float)',
      display: 'flex',
      gap: '14px'
    }
  }, /*#__PURE__*/React.createElement("span", null, "Jouw adres"), /*#__PURE__*/React.createElement("span", null, "Meetpunt uit het netwerk"))))), /*#__PURE__*/React.createElement(Section, null, /*#__PURE__*/React.createElement(SectionHeading, {
    eyebrow: "Onder de motorkap",
    title: "De cijfers achter de voorspelling"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(2,1fr)',
      gap: '20px',
      marginTop: '28px'
    }
  }, /*#__PURE__*/React.createElement(SpecCard, {
    title: "Vernieuwingsinterval",
    value: "elke 5 minuten"
  }, "Een nieuw radarbeeld, gecombineerd met de laatste stationsmeting van tien minuten."), /*#__PURE__*/React.createElement(SpecCard, {
    title: "Vooruitblik",
    value: "120 minuten"
  }, "In stappen van vijf minuten. Daarna schakelt de app over op het reguliere weerbericht."), /*#__PURE__*/React.createElement(SpecCard, {
    title: "Resolutie",
    value: "1 km, gecorrigeerd per station"
  }, "Het radarbeeld wordt bijgesteld met de gemeten neerslag van de stations binnen tien kilometer."), /*#__PURE__*/React.createElement(SpecCard, {
    title: "Zekerheid",
    value: "wordt altijd getoond"
  }, "Elke nowcast krijgt een percentage. Onder de vijftig procent zegt de app dat het onzeker is.")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '24px',
      marginTop: '36px'
    }
  }, /*#__PURE__*/React.createElement(Testimonial, {
    meta: "Enschede \xB7 balkontuin",
    quote: "Ik kijk nu 's ochtends of ik de was buiten kan hangen. Klein dingetje, maar ik doe het elke dag.",
    who: "Marloes de Wit",
    result: "Vaker droge was",
    todo: "te bevestigen"
  }), /*#__PURE__*/React.createElement(Testimonial, {
    meta: "Deventer \xB7 woon-werkfietser",
    quote: "Twintig minuten wachten en dan droog thuiskomen \u2014 dat zag ik in geen enkele andere app.",
    who: "Bram Kloosterman",
    result: "Cijfer nog ophalen",
    todo: "te bevestigen"
  }))), /*#__PURE__*/React.createElement(Section, {
    alt: true,
    id: "vragen"
  }, /*#__PURE__*/React.createElement(SectionHeading, {
    title: "Veelgestelde vragen",
    style: {
      marginBottom: '32px'
    }
  }), /*#__PURE__*/React.createElement(Accordion, {
    items: [{
      q: 'Heb ik een eigen weerstation nodig?',
      a: 'Nee. Je gebruikt de metingen van de stations om je heen. Wil je later toch zelf meten, dan kun je een AgroExact-regenmeter koppelen.'
    }, {
      q: 'Waarom alleen iOS?',
      a: 'We beginnen op iOS zodat we de voorspelling snel kunnen bijsturen op basis van wat gebruikers zien. Android staat op de planning; een datum noemen we pas als die klopt.'
    }, {
      q: 'Hoe nauwkeurig is een nowcast?',
      a: 'Voor het eerste half uur zit hij er meestal dicht op. Daarna neemt de onzekerheid toe, en dat laten we ook zien — de app noemt altijd een percentage in plaats van te doen alsof het zeker is.'
    }, {
      q: 'Wat gebeurt er met mijn locatie?',
      a: 'Je locatie wordt gebruikt om het juiste station te kiezen en verder niet. We verkopen geen locatiegegevens. (Tekst nog afstemmen op het privacystatement.)'
    }, {
      q: 'Werkt het ook in Duitsland?',
      a: 'Ja, in de gebieden waar het netwerk meetpunten heeft. In de app zie je van tevoren of er een station in de buurt staat.'
    }]
  })), /*#__PURE__*/React.createElement(Section, null, /*#__PURE__*/React.createElement(CtaBand, {
    title: "Zie de eerste bui aankomen",
    body: "Gratis te proberen, zonder eigen weerstation. Je hebt alleen een postcode nodig.",
    bullets: ['Nu in de App Store, voor iOS', 'Twee uur vooruit, per vijf minuten', 'Gebouwd op 1.240 echte meetpunten', 'Zegt eerlijk hoe zeker het is']
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "white",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "arrow-right",
      set: "lucide",
      size: 20
    })
  }, "Download in de App Store"))));
}
Object.assign(window, {
  HomePage,
  Section
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/exactcast-web/HomePage.jsx", error: String((e && e.message) || e) }); }

// ui_kits/exactcast-web/NetworkPage.jsx
try { (() => {
const {
  SectionHeading,
  Card,
  Button,
  Icon,
  SpecCard,
  Callout,
  StatTile,
  MeasurementRow,
  ResultRow,
  MeterBar,
  WarnBox,
  CtaBand
} = window.ExactCastAIDesignSystem_6b62ae;
function NetworkPage() {
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--gradient-dark)',
      borderRadius: 'var(--radius-hero)',
      padding: '152px 0 76px',
      position: 'relative',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      background: 'var(--gradient-sheen)',
      pointerEvents: 'none'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      zIndex: 2,
      maxWidth: 'var(--max-width)',
      margin: '0 auto',
      padding: '0 var(--gutter)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--fs-meta)',
      color: 'var(--on-navy-crumb)',
      marginBottom: '18px'
    }
  }, "Home \u203A Het netwerk"), /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: 0,
      fontSize: 'var(--fs-h1)',
      lineHeight: 'var(--lh-h1)',
      fontWeight: 600,
      color: '#fff',
      maxWidth: '16em'
    }
  }, "1.240 regenmeters op echte grond, niet \xE9\xE9n op het vliegveld"), /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--on-navy-body)',
      fontSize: '18px',
      lineHeight: 1.6,
      maxWidth: '40em',
      marginTop: '18px'
    }
  }, "Het AgroExact-netwerk meet al jaren voor boeren en tuinders. ExactCast AI gebruikt diezelfde metingen om jouw nowcast te corrigeren."))), /*#__PURE__*/React.createElement(Section, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '40px',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(SectionHeading, {
    eyebrow: "Waarom het uitmaakt",
    title: "Twee kilometer verschil is twee heel verschillende dagen",
    lead: "Bij buien is neerslag extreem lokaal. Op \xE9\xE9n hoek van de stad valt 18 mm, twee kilometer verderop 2 mm. Een landelijk model ziet dat verschil niet."
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: '8px',
      marginTop: '28px'
    }
  }, /*#__PURE__*/React.createElement(MeasurementRow, {
    status: "red",
    name: "Enschede Zuid",
    meta: "station op 1,2 km",
    advice: "18,4 mm"
  }), /*#__PURE__*/React.createElement(MeasurementRow, {
    status: "amber",
    name: "Enschede Centrum",
    meta: "station op 2,9 km",
    advice: "6,1 mm"
  }), /*#__PURE__*/React.createElement(MeasurementRow, {
    status: "green",
    name: "Enschede Noord",
    meta: "station op 4,4 km",
    advice: "1,8 mm"
  })), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 'var(--fs-caption)',
      color: 'var(--muted)',
      marginTop: '12px'
    }
  }, "Gemeten op 12 augustus 2026, dezelfde bui.")), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--gradient-dark)',
      borderRadius: 'var(--radius-card)',
      padding: '30px',
      color: '#fff'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--fs-label)',
      color: 'var(--on-navy-muted)',
      marginBottom: '22px',
      lineHeight: 1.5
    }
  }, "Wat de stationscorrectie oplevert, gemeten over 90 dagen in Twente."), /*#__PURE__*/React.createElement(ResultRow, {
    label: "Nowcast zonder correctie",
    value: "61% juist"
  }), /*#__PURE__*/React.createElement(ResultRow, {
    label: "Nowcast met stationscorrectie",
    value: "82% juist",
    highlight: true
  }), /*#__PURE__*/React.createElement(ResultRow, {
    label: "Naaste station",
    value: "1,2 km",
    last: true
  }), /*#__PURE__*/React.createElement(MeterBar, {
    leftLabel: "Met correctie",
    rightLabel: "82%",
    pct: 82,
    style: {
      marginTop: '22px'
    }
  }), /*#__PURE__*/React.createElement(MeterBar, {
    leftLabel: "Zonder correctie",
    rightLabel: "61%",
    pct: 61,
    tone: "cost",
    style: {
      marginTop: '12px'
    }
  }), /*#__PURE__*/React.createElement(WarnBox, {
    title: "Eerlijk over deze cijfers",
    style: {
      marginTop: '22px'
    }
  }, "Dit is \xE9\xE9n regio en \xE9\xE9n zomer. We publiceren de meting per regio zodra we een heel jaar hebben. (Cijfers nog te bevestigen.)")))), /*#__PURE__*/React.createElement(Section, {
    alt: true
  }, /*#__PURE__*/React.createElement(SectionHeading, {
    eyebrow: "De meetpunten",
    title: "Wat er precies gemeten wordt"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(2,1fr)',
      gap: '20px',
      marginTop: '28px'
    }
  }, /*#__PURE__*/React.createElement(SpecCard, {
    title: "Neerslag",
    value: "per 10 minuten, mm en duur"
  }, "Elke regenmeter in het netwerk. Dit is de meting die je nowcast bijstelt."), /*#__PURE__*/React.createElement(SpecCard, {
    title: "Temperatuur",
    value: "op 1,5 m (WMO-hoogte)"
  }, "Alleen bij de volledige weerstations in het netwerk."), /*#__PURE__*/React.createElement(SpecCard, {
    title: "Wind",
    value: "snelheid, stoten en richting op 2 m"
  }, "Alleen bij volledige weerstations. Wind verschilt sterk per kavel, dus we tonen altijd welk station het is."), /*#__PURE__*/React.createElement(SpecCard, {
    title: "Luchtvochtigheid",
    value: "op 1,5 m"
  }, "Bij volledige weerstations; wordt gebruikt voor de verdampingsschatting.")), /*#__PURE__*/React.createElement(Callout, {
    title: "Wat het netwerk niet meet",
    style: {
      marginTop: '36px'
    }
  }, "Bodemvochtsensoren zitten niet in het consumentennetwerk. Het sproeiadvies in de app is dus een schatting uit gemeten neerslag en verdamping \u2014 geen bodemmeting. Dat staat ook zo in de app."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4,1fr)',
      gap: '14px',
      marginTop: '36px'
    }
  }, /*#__PURE__*/React.createElement(StatTile, {
    value: "1.240",
    label: "meetpunten"
  }), /*#__PURE__*/React.createElement(StatTile, {
    value: "10 min",
    label: "meetinterval"
  }), /*#__PURE__*/React.createElement(StatTile, {
    value: "4,3 km",
    label: "mediane afstand tot een adres"
  }), /*#__PURE__*/React.createElement(StatTile, {
    value: "NL + DE",
    label: "dekking"
  }))), /*#__PURE__*/React.createElement(Section, null, /*#__PURE__*/React.createElement(CtaBand, {
    title: "Kijk wat het naaste station bij jou meet",
    body: "Postcode invullen is genoeg. Geen account nodig om te kijken."
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "white",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "arrow-right",
      set: "lucide",
      size: 20
    })
  }, "Zoek mijn meetpunt"))));
}
Object.assign(window, {
  NetworkPage
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/exactcast-web/NetworkPage.jsx", error: String((e && e.message) || e) }); }

// ui_kits/exactcast-web/PricingPage.jsx
try { (() => {
const {
  SectionHeading,
  PlanCard,
  Button,
  Icon,
  Callout,
  Accordion,
  Card,
  Field,
  Input,
  StatTile,
  LinkArrow
} = window.ExactCastAIDesignSystem_6b62ae;
function PricingPage({
  onNav
}) {
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--gradient-dark)',
      borderRadius: 'var(--radius-hero)',
      padding: '152px 0 76px',
      position: 'relative',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      background: 'var(--gradient-sheen)',
      pointerEvents: 'none'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      zIndex: 2,
      maxWidth: 'var(--max-width)',
      margin: '0 auto',
      padding: '0 var(--gutter)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--fs-meta)',
      color: 'var(--on-navy-crumb)',
      marginBottom: '18px'
    }
  }, "Home \u203A Prijzen"), /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: 0,
      fontSize: 'var(--fs-h1)',
      lineHeight: 'var(--lh-h1)',
      fontWeight: 600,
      color: '#fff',
      maxWidth: '16em'
    }
  }, "E\xE9n locatie is gratis. Meer locaties kosten minder dan een kop koffie."), /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--on-navy-body)',
      fontSize: '18px',
      lineHeight: 1.6,
      maxWidth: '40em',
      marginTop: '18px'
    }
  }, "Alle bedragen per maand, inclusief btw. Opzeggen kan per maand, in de App Store."))), /*#__PURE__*/React.createElement(Section, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3,1fr)',
      gap: '24px'
    }
  }, /*#__PURE__*/React.createElement(PlanCard, {
    name: "Gratis",
    amount: "\u20AC0",
    per: "altijd",
    features: ['1 locatie', 'Nowcast tot 1 uur', 'Actuele metingen', 'Radarbeeld'],
    cta: /*#__PURE__*/React.createElement(Button, {
      variant: "ghost-dark",
      size: "sm",
      full: true
    }, "Beginnen")
  }), /*#__PURE__*/React.createElement(PlanCard, {
    best: true,
    name: "Plus",
    amount: "\u20AC3,99",
    per: "per maand",
    features: ['5 locaties', 'Nowcast tot 2 uur', 'Push bij regen', 'Historie 12 maanden', 'Zekerheidspercentage'],
    cta: /*#__PURE__*/React.createElement(Button, {
      size: "sm",
      full: true
    }, "Plus nemen")
  }), /*#__PURE__*/React.createElement(PlanCard, {
    name: "Familie",
    amount: "\u20AC6,99",
    per: "per maand",
    features: ['15 locaties', '5 gebruikers', 'Alles uit Plus', 'Historie onbeperkt'],
    cta: /*#__PURE__*/React.createElement(Button, {
      variant: "ghost-dark",
      size: "sm",
      full: true
    }, "Familie nemen")
  })), /*#__PURE__*/React.createElement(Callout, {
    title: "Wat is een 'locatie'?",
    style: {
      marginTop: '36px'
    }
  }, "E\xE9n adres of plek waarvan je de nowcast volgt: je huis, de tuin van je ouders, de camping, het sportveld van de club. Je kunt ze op elk moment wisselen. Een locatie is niet hetzelfde als een weerstation \u2014 dat komt uit het netwerk en heb je zelf niet nodig.")), /*#__PURE__*/React.createElement(Section, {
    alt: true
  }, /*#__PURE__*/React.createElement(SectionHeading, {
    eyebrow: "Eerst kijken",
    title: "Staat er een meetpunt bij jou in de buurt?",
    lead: "Vul je postcode in. Je ziet meteen hoe ver het naaste station staat \u2014 hoe dichterbij, hoe scherper de nowcast."
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '.9fr 1.1fr',
      gap: '36px',
      marginTop: '40px',
      alignItems: 'start'
    }
  }, /*#__PURE__*/React.createElement(Card, {
    pad: "28px"
  }, /*#__PURE__*/React.createElement(Field, {
    label: "Postcode",
    hint: "Alleen de vier cijfers is genoeg"
  }, /*#__PURE__*/React.createElement(Input, {
    size: "lg",
    defaultValue: "7511"
  })), /*#__PURE__*/React.createElement(Button, {
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "arrow-right",
      set: "lucide",
      size: 20
    })
  }, "Zoek meetpunten"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3,1fr)',
      gap: '14px',
      marginTop: '24px'
    }
  }, /*#__PURE__*/React.createElement(StatTile, {
    value: "1,2 km",
    label: "naaste station"
  }), /*#__PURE__*/React.createElement(StatTile, {
    value: "6",
    label: "binnen 10 km"
  }), /*#__PURE__*/React.createElement(StatTile, {
    value: "Goed",
    label: "dekking"
  })), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 'var(--fs-body-sm)',
      color: 'var(--ink-heading)',
      lineHeight: 1.6,
      marginTop: '20px',
      marginBottom: 0
    }
  }, "In Enschede staat het naaste meetpunt op 1,2 kilometer. Dat is dicht genoeg voor een nowcast op straatniveau.")), /*#__PURE__*/React.createElement(Card, {
    pad: "28px"
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      margin: '0 0 10px',
      fontSize: 'var(--fs-h3)',
      fontWeight: 600,
      color: 'var(--ink-heading)'
    }
  }, "Nog geen station bij jou?"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 'var(--fs-body-sm)',
      color: 'var(--muted)',
      lineHeight: 1.6
    }
  }, "Dan werkt de app nog steeds \u2014 hij gebruikt dan het radarbeeld zonder lokale correctie, en zegt dat er ook bij. Zodra er een meetpunt in de buurt komt, gaat je nowcast automatisch mee vooruit."), /*#__PURE__*/React.createElement(LinkArrow, {
    onClick: e => {
      e.preventDefault();
      onNav('Netwerk');
    }
  }, "Bekijk de dekkingskaart")))), /*#__PURE__*/React.createElement(Section, null, /*#__PURE__*/React.createElement(SectionHeading, {
    title: "Vragen over het abonnement",
    style: {
      marginBottom: '32px'
    }
  }), /*#__PURE__*/React.createElement(Accordion, {
    items: [{
      q: 'Kan ik maandelijks opzeggen?',
      a: 'Ja. Het abonnement loopt via de App Store; daar zeg je het op en het stopt aan het eind van de maand.'
    }, {
      q: 'Zit er een proefperiode bij?',
      a: 'Plus kun je twee weken gratis proberen. Daarna gaat het abonnement automatisch door tenzij je opzegt.'
    }, {
      q: 'Wat als ik later een eigen regenmeter wil?',
      a: 'Die koppel je aan je account. Je locatie gebruikt dan jouw eigen meting in plaats van het naaste netwerkstation.'
    }]
  })));
}
Object.assign(window, {
  PricingPage
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/exactcast-web/PricingPage.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Icon = __ds_scope.Icon;

__ds_ns.Wordmark = __ds_scope.Wordmark;

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.Eyebrow = __ds_scope.Eyebrow;

__ds_ns.LinkArrow = __ds_scope.LinkArrow;

__ds_ns.SectionHeading = __ds_scope.SectionHeading;

__ds_ns.ComparisonTable = __ds_scope.ComparisonTable;

__ds_ns.MeasurementRow = __ds_scope.MeasurementRow;

__ds_ns.MeterBar = __ds_scope.MeterBar;

__ds_ns.MetricCard = __ds_scope.MetricCard;

__ds_ns.ResultRow = __ds_scope.ResultRow;

__ds_ns.ScaleBar = __ds_scope.ScaleBar;

__ds_ns.StatTile = __ds_scope.StatTile;

__ds_ns.StatusDot = __ds_scope.StatusDot;

__ds_ns.Accordion = __ds_scope.Accordion;

__ds_ns.Callout = __ds_scope.Callout;

__ds_ns.StatusCard = __ds_scope.StatusCard;

__ds_ns.WarnBox = __ds_scope.WarnBox;

__ds_ns.Field = __ds_scope.Field;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.Select = __ds_scope.Select;

__ds_ns.CtaBand = __ds_scope.CtaBand;

__ds_ns.PhoneMock = __ds_scope.PhoneMock;

__ds_ns.PlanCard = __ds_scope.PlanCard;

__ds_ns.SpecCard = __ds_scope.SpecCard;

__ds_ns.Testimonial = __ds_scope.Testimonial;

__ds_ns.TrustBar = __ds_scope.TrustBar;

__ds_ns.PillTabs = __ds_scope.PillTabs;

__ds_ns.SiteFooter = __ds_scope.SiteFooter;

__ds_ns.SiteHeader = __ds_scope.SiteHeader;

__ds_ns.TabBar = __ds_scope.TabBar;

})();
