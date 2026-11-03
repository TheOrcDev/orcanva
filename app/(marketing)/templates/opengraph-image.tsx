import { renderShareImage } from "@/lib/seo/share-image";

export {
  SHARE_IMAGE_SIZE as size,
  SHARE_IMAGE_TYPE as contentType,
} from "@/lib/seo/share-image";

export const alt = "Orcanva: Free templates for thumbnails and social posts.";

const OpengraphImage = () =>
  renderShareImage({
    subtitle: "Pick one, drop in your photos, download. No watermark.",
    title: "Free templates.",
  });

export default OpengraphImage;
