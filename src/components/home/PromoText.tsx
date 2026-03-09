import { forwardRef } from "react";

interface PromoTextProps {
  html: string;
}

const PromoText = forwardRef<HTMLDivElement, PromoTextProps>(({ html }, ref) => {
  // Preserve \n\n as paragraph breaks
  const processedHtml = html
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br/>');
  const wrappedHtml = `<p>${processedHtml}</p>`;

  return (
    <div
      ref={ref}
      className="prose prose-invert max-w-none text-center [&_p]:text-foreground [&_strong]:text-primary [&_p]:mb-3"
      dangerouslySetInnerHTML={{ __html: wrappedHtml }}
    />
  );
});

PromoText.displayName = "PromoText";

export default PromoText;
