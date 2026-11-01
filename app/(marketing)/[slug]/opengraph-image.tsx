import { notFound } from "next/navigation";

import { renderShareImage } from "@/lib/seo/share-image";
import { SIZE_PAGES, findSizePage } from "@/lib/seo/size-pages";

export {
  SHARE_IMAGE_SIZE as size,
  SHARE_IMAGE_TYPE as contentType,
} from "@/lib/seo/share-image";

export const alt = "Orcanva: a free design maker at the exact size.";

export const generateStaticParams = () =>
  SIZE_PAGES.map((page) => ({ slug: page.slug }));

const OpengraphImage = async ({
  params,
}: {
  params: Promise<{ slug: string }>;
}) => {
  const { slug } = await params;
  const page = findSizePage(slug);
  if (!page) {
    notFound();
  }
  return renderShareImage(page.share);
};

export default OpengraphImage;
