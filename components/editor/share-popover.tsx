"use client";

import {
  RiCloseLine,
  RiFileCopyLine,
  RiGlobalLine,
  RiLockLine,
  RiMailLine,
  RiShareLine,
  RiTeamLine,
} from "@remixicon/react";
import { useId, useState, useTransition } from "react";
import type { FormEvent } from "react";

import { UserAvatar } from "@/components/auth/user-menu";
import {
  useEditor,
  useEditorStoreApi,
} from "@/components/editor/editor-store-context";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toast";
import { setDesignVisibility } from "@/lib/actions/designs";
import { listShares, shareDesign, unshareDesign } from "@/lib/actions/shares";
import type { SharePerson } from "@/lib/db/queries/shares";
import { stopIfOutdated } from "@/lib/editor/outdated";

const Person = ({
  person,
  disabled,
  onRemove,
}: {
  person: SharePerson;
  disabled: boolean;
  onRemove: () => void;
}) => (
  <Item size="xs">
    <ItemMedia>
      {person.name ? (
        <UserAvatar
          viewer={{ image: person.image, name: person.name }}
          size="sm"
        />
      ) : (
        <Avatar size="sm">
          <AvatarFallback>
            <RiMailLine />
          </AvatarFallback>
        </Avatar>
      )}
    </ItemMedia>
    <ItemContent className="min-w-0">
      <ItemTitle className="w-full">
        <span className="truncate">{person.name ?? person.email}</span>
      </ItemTitle>
      <ItemDescription>
        <span className="block truncate">
          {person.name ? person.email : "Invite sent"}
        </span>
      </ItemDescription>
    </ItemContent>
    <ItemActions>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={`Stop sharing with ${person.email}`}
        disabled={disabled}
        onClick={onRemove}
      >
        <RiCloseLine />
      </Button>
    </ItemActions>
  </Item>
);

// Invite people by email, and see and remove who it's shared with. `people`
// is null until the list has loaded.
const SharePeople = ({
  designId,
  people,
  onPeopleChange,
}: {
  designId: string;
  people: SharePerson[] | null;
  onPeopleChange: (people: SharePerson[]) => void;
}) => {
  const store = useEditorStoreApi();
  const id = useId();
  const [email, setEmail] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const address = email.trim().toLowerCase();
    if (!address) {
      return;
    }
    startTransition(async () => {
      try {
        const result = await shareDesign({ email: address, id: designId });
        if (!result.ok) {
          toast.add({ title: result.error, type: "error" });
          return;
        }
        onPeopleChange(result.people);
        setEmail("");
        toast.add(
          result.emailed
            ? { title: `Invite sent to ${address}`, type: "success" }
            : {
                description: "Add them again to send it once more.",
                title: `Shared with ${address}, but the email didn't go out`,
                type: "warning",
              }
        );
      } catch (error) {
        if (!stopIfOutdated(store, error)) {
          toast.add({ title: "Could not share it", type: "error" });
        }
      }
    });
  };

  const handleRemove = (person: SharePerson) => {
    startTransition(async () => {
      try {
        onPeopleChange(
          await unshareDesign({ email: person.email, id: designId })
        );
      } catch (error) {
        if (!stopIfOutdated(store, error)) {
          toast.add({
            title: `Could not stop sharing with ${person.email}`,
            type: "error",
          });
        }
      }
    });
  };

  return (
    <Field>
      <FieldLabel htmlFor={`${id}-email`}>Share with people</FieldLabel>
      <form onSubmit={handleSubmit}>
        <InputGroup>
          <InputGroupInput
            id={`${id}-email`}
            type="email"
            autoComplete="off"
            placeholder="name@example.com"
            value={email}
            disabled={isPending}
            onChange={(event) => setEmail(event.target.value)}
          />
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              type="submit"
              variant="secondary"
              size="xs"
              disabled={isPending || email.trim() === ""}
            >
              {isPending ? <Spinner data-icon="inline-start" /> : null}
              Invite
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </form>
      <FieldDescription>
        They get an email with a link. New to Orcanva? It asks them to create an
        account with that email first.
      </FieldDescription>
      {people === null ? <Spinner className="mx-auto" /> : null}
      {people && people.length > 0 ? (
        <div className="-mx-3 max-h-56 overflow-y-auto">
          <ItemGroup>
            {people.map((person) => (
              <Person
                key={person.email}
                person={person}
                disabled={isPending}
                onRemove={() => handleRemove(person)}
              />
            ))}
          </ItemGroup>
        </div>
      ) : null}
    </Field>
  );
};

// Owners share the design with people by email, choose whether anyone can
// open it, and copy its link. Everyone else sees why they can open it.
export const SharePopover = () => {
  const store = useEditorStoreApi();
  const role = useEditor((state) => state.role);
  const visibility = useEditor((state) => state.visibility);
  const designId = useEditor((state) => state.designId);
  const id = useId();
  const [isPending, startTransition] = useTransition();
  const [link, setLink] = useState("");
  const [people, setPeople] = useState<SharePerson[] | null>(null);

  if (role === "member") {
    return (
      <Badge variant="secondary">
        <RiTeamLine />
        Shared with you
      </Badge>
    );
  }
  if (role !== "owner") {
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
      } catch (error) {
        if (!stopIfOutdated(store, error)) {
          toast.add({
            title: "Could not change who can see it",
            type: "error",
          });
        }
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

  const loadPeople = async () => {
    try {
      setPeople(await listShares(designId));
    } catch (error) {
      setPeople([]);
      if (!stopIfOutdated(store, error)) {
        toast.add({
          title: "Could not load who it's shared with",
          type: "error",
        });
      }
    }
  };

  return (
    <Popover
      onOpenChange={(open) => {
        if (open) {
          setLink(window.location.href);
          loadPeople();
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
      <PopoverContent align="end" className="w-96">
        <PopoverHeader>
          <PopoverTitle>Share</PopoverTitle>
          <PopoverDescription>
            {isPublic
              ? "Anyone can find this design in the gallery and edit it with you, signed in or not."
              : "Only you and the people you share it with can open this design."}
          </PopoverDescription>
        </PopoverHeader>
        <FieldGroup>
          <SharePeople
            designId={designId}
            people={people}
            onPeopleChange={setPeople}
          />
          <FieldSeparator />
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
                It opens for you and the people you share it with. Make it
                public to send it to anyone else.
              </FieldDescription>
            )}
          </Field>
        </FieldGroup>
      </PopoverContent>
    </Popover>
  );
};
