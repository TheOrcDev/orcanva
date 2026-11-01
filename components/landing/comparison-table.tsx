import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface ComparisonRow {
  feature: string;
  ours: string;
  theirs: string;
}

// Orcanva beside another product, one row per feature, with a caption that
// says when the other side was checked. Cells wrap, so phones keep all three
// columns on screen.
export const ComparisonTable = ({
  caption,
  rows,
  them,
}: {
  caption: string;
  rows: readonly ComparisonRow[];
  them: string;
}) => (
  <div className="bg-card ring-foreground/10 rounded-3xl p-3 ring-1 sm:p-5">
    <Table>
      <TableCaption>{caption}</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>
            <span className="sr-only">Feature</span>
          </TableHead>
          <TableHead>Orcanva</TableHead>
          <TableHead>
            <span className="text-muted-foreground">{them}</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.feature}>
            <TableHead scope="row">
              <span className="whitespace-normal">{row.feature}</span>
            </TableHead>
            <TableCell>
              <span className="whitespace-normal">{row.ours}</span>
            </TableCell>
            <TableCell>
              <span className="text-muted-foreground whitespace-normal">
                {row.theirs}
              </span>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </div>
);
