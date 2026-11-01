import { renderShareImage } from "@/lib/seo/share-image";

export {
  SHARE_IMAGE_SIZE as size,
  SHARE_IMAGE_TYPE as contentType,
} from "@/lib/seo/share-image";

export const alt = "Orcanva: Remove AI metadata from images.";

const OpengraphImage = () =>
  renderShareImage({
    subtitle: "Content Credentials, AI tags, EXIF and GPS. In your browser.",
    title: "Remove AI metadata.",
  });

export default OpengraphImage;
