import { renderShareImage } from "@/lib/seo/share-image";

export {
  SHARE_IMAGE_SIZE as size,
  SHARE_IMAGE_TYPE as contentType,
} from "@/lib/seo/share-image";

export const alt = "Orcanva: Free AI image upscaler.";

const OpengraphImage = () =>
  renderShareImage({
    subtitle: "2× or 4×, sharpened in your browser. No sign-up.",
    title: "Free AI image upscaler.",
  });

export default OpengraphImage;
