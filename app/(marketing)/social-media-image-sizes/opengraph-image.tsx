import { renderShareImage } from "@/lib/seo/share-image";

export {
  SHARE_IMAGE_SIZE as size,
  SHARE_IMAGE_TYPE as contentType,
} from "@/lib/seo/share-image";

export const alt = "Orcanva: Social media image sizes.";

const OpengraphImage = () =>
  renderShareImage({
    subtitle: "Every size in pixels, from YouTube thumbnails to Stories.",
    title: "Social media image sizes.",
  });

export default OpengraphImage;
