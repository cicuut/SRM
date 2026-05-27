import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

export interface DynamicVisitRow {
  visit_number: string;
  visit_date: string;
  record_number: string;
  patient_name: string;
  visit_type: string;
  created_by: string;
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
  keluhan?: string;
  blood_pressure?: string;
  body_temperature?: string;
  respiratory_rate?: string;
  heart_rate?: string;
  height_cm?: string;
  weight_kg?: string;
  amount?: number;
  status?: string;
  baby_weight?: string;
  baby_height?: string;
  baby_temp?: string;
  head_circumference?: string;
  abdominal_circumference?: string;
  dosage_given?: string;
  vaccine_given?: string;
  kb_method?: string;
  return_visit_date?: string;
  complaint?: string;
  [key: string]: any;
}

interface ColumnConfig {
  header: string;
  key: string;
  width: number;
}

export const getDynamicColumns = (visitType: string): ColumnConfig[] => {
  const baseColumns: ColumnConfig[] = [
    { header: "No. Kunjungan", key: "visit_number", width: 18 },
    { header: "Waktu", key: "visit_date", width: 18 },
    { header: "RM ID", key: "record_number", width: 18 },
    { header: "Nama Pasien", key: "patient_name", width: 22 },
    { header: "Tipe", key: "visit_type", width: 18 },
    { header: "Dibuat Oleh", key: "created_by", width: 18 },
  ];

  if (visitType === "Umum") {
    return [
      ...baseColumns,
      { header: "Subjective (S)", key: "subjective", width: 25 },
      { header: "Objective (O)", key: "objective", width: 25 },
      { header: "Assessment (A)", key: "assessment", width: 25 },
      { header: "Plan (P)", key: "plan", width: 25 },
      { header: "Total Biaya", key: "amount", width: 15 },
      { header: "Status", key: "status", width: 12 },
    ];
  }

  if (visitType === "Kehamilan") {
    return [
      ...baseColumns,
      { header: "Berat", key: "weight_kg", width: 18 },
      { header: "Tinggi", key: "height_cm", width: 18 },
      { header: "Tekanan Darah", key: "blood_pressure", width: 18 },
      { header: "Suhu Tubuh", key: "body_temperature", width: 18 },
      { header: "Frekuensi Pernapasan", key: "respiratory_rate", width: 18 },
      { header: "Detak Jantung", key: "heart_rate", width: 18 },
      { header: "Subjective (S)", key: "subjective", width: 25 },
      { header: "Objective (O)", key: "objective", width: 25 },
      { header: "Assessment (A)", key: "assessment", width: 25 },
      { header: "Plan (P)", key: "plan", width: 25 },
      { header: "Total Biaya", key: "amount", width: 15 },
      { header: "Status", key: "status", width: 18 },
    ];
  }

  if (visitType === "Imunisasi") {
    return [
      ...baseColumns,
      { header: "Berat Bayi", key: "baby_weight", width: 18 },
      { header: "Tinggi Bayi", key: "baby_height", width: 18 },
      { header: "Suhu Tubuh", key: "baby_temp", width: 18 },
      { header: "Lingkaran Kepala", key: "head_circumference", width: 18 },
      { header: "Lingkaran Perut", key: "abdominal_circumference", width: 18 },
      { header: "Vaksin", key: "vaccine_given", width: 18 },
      { header: "Dosis", key: "dosage_given", width: 18 },
      { header: "Total Biaya", key: "amount", width: 15 },
      { header: "Status", key: "status", width: 18 },
    ];
  }

   if (visitType === "Keluarga Berencana") {
    return [
      ...baseColumns,
      { header: "Berat", key: "weight_kg", width: 18 },
      { header: "Tekanan Darah", key: "blood_pressure", width: 18 },
      { header: "Metode Kontraseptif", key: "kb_method", width: 18 },
      { header: "Kunjungan Berikutnya", key: "return_visit_date", width: 18 },
      { header: "Keluhan", key: "complaint", width: 25 },
      { header: "Total Biaya", key: "amount", width: 15 },
      { header: "Status", key: "status", width: 18 },
    ];
  }


  return baseColumns;
};

export const handleExportXlsxData = async (
  tableData: DynamicVisitRow[],
  visitType: string,
  startDate: string,
  endDate: string,
) => {
  if (!tableData || tableData.length === 0) {
    alert(
      "Tidak ada data yang bisa diexport. Silakan cari data terlebih dahulu.",
    );
    return;
  }

  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Laporan Kunjungan");
    worksheet.views = [{ showGridLines: true }];

    const activeColumns = getDynamicColumns(visitType);
    worksheet.columns = activeColumns.map((col) => ({
      header: col.header,
      key: col.key,
      width: col.width,
    }));

    const headerRow = worksheet.getRow(1);
    headerRow.height = 30;
    headerRow.eachCell((cell) => {
      cell.font = {
        name: "Arial",
        size: 10,
        bold: true,
        color: { argb: "FFFFFF" },
      };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "739072" },
      };
      cell.alignment = {
        horizontal: "center",
        vertical: "middle",
        wrapText: true,
      };
    });

    tableData.forEach((item: DynamicVisitRow, index: number) => {
      const rowData: Record<string, any> = {};
      activeColumns.forEach((col) => {
        rowData[col.key] = item[col.key] !== undefined ? item[col.key] : "-";
      });

      const row = worksheet.addRow(rowData);

      let maxLines = 1;
      activeColumns.forEach((col) => {
        const cellValue = rowData[col.key];
        if (cellValue && typeof cellValue === "string") {
          const linesByNewline = cellValue.split("\n").length;

          const linesByLength = Math.ceil(cellValue.length / 25);

          const lines = Math.max(linesByNewline, linesByLength);
          if (lines > maxLines) {
            maxLines = lines;
          }
        }
      });
      row.height = Math.min(Math.max(20, maxLines * 15), 120);
      const isZebra = index % 2 === 1;

      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cell.font = { name: "Arial", size: 10 };
        cell.border = {
          top: { style: "thin", color: { argb: "D3D3D3" } },
          left: { style: "thin", color: { argb: "D3D3D3" } },
          bottom: { style: "thin", color: { argb: "D3D3D3" } },
          right: { style: "thin", color: { argb: "D3D3D3" } },
        };

        if (isZebra) {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "EEF3E9" },
          };
        }

        const columnKey = activeColumns[colNumber - 1].key;

        if (
          [
            "visit_number",
            "visit_date",
            "record_number",
            "status",
            "weight_kg",
            "height_cm",
            "blood_pressure",
            "body_temperature",
            "respiratory_rate",
            "heart_rate",
          ].includes(columnKey)
        ) {
          cell.alignment = { horizontal: "center", vertical: "top" };
        } else if (
          ["subjective", "objective", "assessment", "plan", "keluhan"].includes(
            columnKey,
          )
        ) {
          cell.alignment = {
            horizontal: "left",
            vertical: "top",
            wrapText: true,
          };
        } else if (columnKey === "amount") {
          cell.value = Number(cell.value);
          cell.numFmt = '"Rp"#,##0';
          cell.alignment = { horizontal: "right", vertical: "top" };
        } else {
          cell.alignment = { horizontal: "left", vertical: "top" };
        }
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    saveAs(
      blob,
      `Laporan_Kunjungan_${visitType}_${startDate}_${endDate}.xlsx`,
    );
  } catch (error) {
    console.error("Gagal menyusun excel:", error);
  }
};
