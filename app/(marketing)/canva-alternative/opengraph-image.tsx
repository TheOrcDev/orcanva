import { renderShareImage } from "@/lib/seo/share-image";

export {
  SHARE_IMAGE_SIZE as size,
  SHARE_IMAGE_TYPE as contentType,
} from "@/lib/seo/share-image";

export const alt = "Orcanva: The free Canva alternative.";

const OpengraphImage = () =>
  renderShareImage({
    subtitle: "For thumbnails and social images. Background removal included.",
    title: "The free Canva alternative.",
  });

export default OpengraphImage;
