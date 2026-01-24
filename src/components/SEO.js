import { Helmet } from "react-helmet-async";

export default function SEO({
  title,
  description,
  keywords,
  canonical,
  noIndex = false,
}) {
  return (
    <Helmet>
      {/* Primary SEO */}
      {title && <title>{title}</title>}
      {description && (
        <meta name="description" content={description} />
      )}
      {keywords && (
        <meta name="keywords" content={keywords} />
      )}

      {/* Canonical URL */}
      {canonical && (
        <link rel="canonical" href={canonical} />
      )}

      {/* Robots */}
      {noIndex && (
        <meta name="robots" content="noindex,nofollow" />
      )}

      {/* Open Graph (WhatsApp / Facebook) */}
      {title && (
        <meta property="og:title" content={title} />
      )}
      {description && (
        <meta property="og:description" content={description} />
      )}
      {canonical && (
        <meta property="og:url" content={canonical} />
      )}
      <meta property="og:type" content="website" />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      {title && (
        <meta name="twitter:title" content={title} />
      )}
      {description && (
        <meta
          name="twitter:description"
          content={description}
        />
      )}
    </Helmet>
  );
}
