"use client";

import type Konva from "konva";
import { useEffect, useRef } from "react";
import { Transformer } from "react-konva";

import { useEditor } from "@/components/editor/editor-store-context";
import { usePeersHere } from "@/hooks/use-peers-here";
import type { Peer } from "@/lib/collab/presence";

// An outline in the peer's color around what they have selected. A
// non-interactive Transformer follows the nodes' size and rotation for free.
const PeerSelection = ({ peer }: { peer: Peer }) => {
  const transformerRef = useRef<Konva.Transformer>(null);
  const selection = peer.selection.join(" ");
  const elements = useEditor((state) => state.doc.document.elements);

  useEffect(() => {
    const transformer = transformerRef.current;
    const stage = transformer?.getStage();
    if (!(transformer && stage)) {
      return;
    }
    // Element nodes mount after their rows arrive, so this re-runs as the
    // document changes and only picks elements that exist
    const existing = new Set(elements.map((element) => element.id));
    const nodes = selection
      .split(" ")
      .filter((id) => existing.has(id))
      .map((id) => stage.findOne(`#${id}`))
      .filter((node): node is Konva.Node => node !== undefined);
    transformer.nodes(nodes);
    transformer.getLayer()?.batchDraw();
  }, [selection, elements]);

  return (
    <Transformer
      ref={transformerRef}
      borderStroke={peer.color}
      borderStrokeWidth={2}
      enabledAnchors={[]}
      ignoreStroke
      listening={false}
      resizeEnabled={false}
      rotateEnabled={false}
    />
  );
};

// What everyone else on this page has selected
export const RemoteSelections = () => {
  const peers = usePeersHere();
  return peers
    .filter((peer) => peer.selection.length > 0)
    .map((peer) => <PeerSelection key={peer.clientId} peer={peer} />);
};
