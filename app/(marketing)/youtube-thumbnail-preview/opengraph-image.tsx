import { renderShareImage } from "@/lib/seo/share-image";

export {
  SHARE_IMAGE_SIZE as size,
  SHARE_IMAGE_TYPE as contentType,
} from "@/lib/seo/share-image";

export const alt = "Orcanva: Free YouTube thumbnail preview.";

const OpengraphImage = () =>
  renderShareImage({
    subtitle: "See it at real size, in light and dark. No sign-up.",
    title: "YouTube thumbnail preview.",
  });

export default OpengraphImage;
