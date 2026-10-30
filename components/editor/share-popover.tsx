"use client";

import {
  RiFileCopyLine,
  RiGlobalLine,
  RiLockLine,
  RiShareLine,
} from "@remixicon/react";
import { useId, useState, useTransition } from "react";

import {
  useEditor,
  useEditorStoreApi,
} from "@/components/editor/editor-store-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toast";
import { setDesignVisibility } from "@/lib/actions/designs";

// Owners choose who can open the design and copy its link; everyone else
// is on a public design, and sees that it is
export const SharePopover = () => {
  const store = useEditorStoreApi();
  const isOwner = useEditor((state) => state.role === "owner");
  const visibility = useEditor((state) => state.visibility);
  const designId = useEditor((state) => state.designId);
  const id = useId();
  const [isPending, startTransition] = useTransition();
  const [link, setLink] = useState("");

  if (!isOwner) {
    return (
      <Badge variant="secondary">
        <RiGlobalLine />
        Public
      </Badge>
    );
  }

  const isPublic = visibility === "public";

  const handleChange = (checked: boolean) => {
    const next = checked ? "public" : "private";
    startTransition(async () => {
      try {
        await setDesignVisibility({ id: designId, visibility: next });
        store.getState().setVisibility(next);
      } catch {
        toast.add({ title: "Could not change who can see it", type: "error" });
      }
    });
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast.add({ title: "Link copied", type: "success" });
    } catch {
      toast.add({ title: "Could not copy the link", type: "error" });
    }
  };

  return (
    <Popover
      onOpenChange={(open) => {
        if (open) {
          setLink(window.location.href);
        }
      }}
    >
      <PopoverTrigger render={<Button variant="outline" />}>
        {isPublic ? (
          <RiShareLine data-icon="inline-start" />
        ) : (
          <RiLockLine data-icon="inline-start" />
        )}
        {isPublic ? "Public" : "Private"}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <PopoverHeader>
          <PopoverTitle>Share</PopoverTitle>
          <PopoverDescription>
            {isPublic
              ? "Anyone can find this design in the gallery and edit it with you, signed in or not."
              : "Only you can open this design."}
          </PopoverDescription>
        </PopoverHeader>
        <FieldGroup>
          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel htmlFor={`${id}-public`}>Public</FieldLabel>
              <FieldDescription>Listed for everyone to edit</FieldDescription>
            </FieldContent>
            <Switch
              id={`${id}-public`}
              checked={isPublic}
              disabled={isPending}
              onCheckedChange={handleChange}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-link`}>Link</FieldLabel>
            <InputGroup>
              <InputGroupInput id={`${id}-link`} value={link} readOnly />
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  aria-label="Copy link"
                  size="icon-xs"
                  onClick={handleCopy}
                >
                  <RiFileCopyLine />
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
            {isPublic ? null : (
              <FieldDescription>
                Make it public before sending it to anyone else.
              </FieldDescription>
            )}
          </Field>
        </FieldGroup>
      </PopoverContent>
    </Popover>
  );
};
