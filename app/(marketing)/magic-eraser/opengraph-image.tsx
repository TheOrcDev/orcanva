import { renderShareImage } from "@/lib/seo/share-image";

export {
  SHARE_IMAGE_SIZE as size,
  SHARE_IMAGE_TYPE as contentType,
} from "@/lib/seo/share-image";

export const alt = "Orcanva: Free magic eraser.";

const OpengraphImage = () =>
  renderShareImage({
    subtitle: "Brush over it and it's gone, in your browser. No sign-up.",
    title: "Free magic eraser.",
  });

export default OpengraphImage;
