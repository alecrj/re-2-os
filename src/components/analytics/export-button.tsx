"use client";

import { useState } from "react";
import { Download, FileSpreadsheet, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { trpc } from "@/lib/trpc/client";
import { useToast } from "@/hooks/use-toast";

interface ExportButtonProps {
  period: "7d" | "30d" | "90d" | "ytd" | "all";
}

function downloadCSV(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function ExportButton({ period }: ExportButtonProps) {
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState<string | null>(null);

  const salesExport = trpc.analytics.exportSalesCSV.useQuery(
    { period },
    { enabled: false }
  );

  const inventoryExport = trpc.analytics.exportInventoryCSV.useQuery(
    undefined,
    { enabled: false }
  );

  const profitExport = trpc.analytics.exportProfitCSV.useQuery(
    { period },
    { enabled: false }
  );

  const handleExport = async (type: "sales" | "inventory" | "profit") => {
    setIsExporting(type);
    try {
      let result;
      switch (type) {
        case "sales":
          result = await salesExport.refetch();
          break;
        case "inventory":
          result = await inventoryExport.refetch();
          break;
        case "profit":
          result = await profitExport.refetch();
          break;
      }

      if (result.data) {
        downloadCSV(result.data.filename, result.data.content);
        toast({
          title: "Export complete",
          description: `Downloaded ${result.data.filename}`,
        });
      }
    } catch {
      toast({
        title: "Export failed",
        description: "Could not generate the report. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(null);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={isExporting !== null}>
          {isExporting ? (
            <>
              <span className="animate-spin mr-2">
                <FileSpreadsheet className="h-4 w-4" />
              </span>
              Exporting...
            </>
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" />
              Export
              <ChevronDown className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Export Reports</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => handleExport("sales")}
          disabled={isExporting !== null}
        >
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          Sales Report (CSV)
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleExport("profit")}
          disabled={isExporting !== null}
        >
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          Profit Report (CSV)
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleExport("inventory")}
          disabled={isExporting !== null}
        >
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          Inventory Report (CSV)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
