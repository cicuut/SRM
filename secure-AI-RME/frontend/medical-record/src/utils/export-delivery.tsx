import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

export interface DynamicVisitRow {
  record_number: string;
  created_at: string;
  patient_name: string;
  patient_age: string;
  national_id: string;
  family_name: string;
  family_age: string;
  address: string;
  delivery_date: string;
  delivery_type: string;
  deliver_complications: string;
  baby_gender: string;
  baby_weight: string;
  baby_length: string;
  baby_complications: string;
}

interface ColumnConfig {
  header: string;
  key: string;
  width: number;
}

export const getDynamicColumns = (): ColumnConfig[] => {
  const baseColumns: ColumnConfig[] = [
    { header: "No. Rekam Medis", key: "record_number", width: 18 },
    { header: "Tanggal Persalinan", key: "delivery_date", width: 18 },
    { header: "Nama Pasien", key: "patient_name", width: 22 },
    { header: "Umur Pasien", key: "patient_age", width: 18 },
    { header: "NIK", key: "national_id", width: 22 },
    { header: "Nama Suami", key: "family_name", width: 22 },
    { header: "Umur Suami", key: "family_age", width: 18 },
    { header: "Alamat", key: "address", width: 30 },
    { header: "Metode Persalinan", key: "delivery_type", width: 18 },
    {
      header: "Komplikasi Persalinan",
      key: "deliver_complications",
      width: 30,
    },
    { header: "Jenis Kelamin Bayi", key: "baby_gender", width: 18 },
    { header: "Berat Bayi", key: "baby_weight", width: 18 },
    { header: "Panjang Bayi", key: "baby_length", width: 18 },
    { header: "Komplikasi Bayi", key: "baby_complication", width: 20 },
  ];
  return baseColumns;
};

export const handleExportXlsxData = async (
  tableData: DynamicVisitRow[],
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
    const worksheet = workbook.addWorksheet("Laporan Persalinan");
    worksheet.views = [{ showGridLines: true }];

    const activeColumns = getDynamicColumns();
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

    tableData.forEach((item: any, index: number) => {
      const rowData: Record<string, any> = {};

      const pName = item.patient_name || "-";
      const pNik = item.national_id || "-";
      const pAge = item.patient_age || "-";
      const fName = item.family_name || "-";
      const fAge = item.family_age || "-";
      const pAddress = item.address || "-";
      const dDate = item.delivery_date || "-";
      const dType = item.delivery_type || "-";
      const dComp = item.deliver_complications || "-";
      const bGender = item.baby_gender || "-";
      const bWeight = item.baby_weight ?? 0;
      const bLength = item.baby_length ?? 0;
      const bComp = item.baby_complications || item.baby_complications || "-";

      rowData["record_number"] = item.record_number || "-";
      rowData["delivery_date"] = dDate;
      rowData["patient_name"] = pName;
      rowData["patient_age"] = pAge;
      rowData["national_id"] = pNik;
      rowData["family_name"] = fName;
      rowData["family_age"] = fAge;
      rowData["address"] = pAddress;
      rowData["delivery_type"] = dType;
      rowData["deliver_complications"] = dComp;
      rowData["baby_gender"] = bGender;
      rowData["baby_weight"] = bWeight;
      rowData["baby_length"] = bLength;
      rowData["baby_complications"] = bComp;

      const row = worksheet.addRow(rowData);

      let maxLines = 1;
      activeColumns.forEach((col) => {
        const cellValue = rowData[col.key];
        if (cellValue && typeof cellValue === "string") {
          const linesByNewline = cellValue.split("\n").length;
          const linesByLength = Math.ceil(cellValue.length / 25);
          const lines = Math.max(linesByNewline, linesByLength);
          if (lines > maxLines) maxLines = lines;
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
            "record_number",
            "delivery_date",
            "national_id",
            "baby_gender",
          ].includes(columnKey)
        ) {
          cell.alignment = { horizontal: "center", vertical: "top" };
        } else if (["baby_weight", "baby_length"].includes(columnKey)) {
          cell.value = Number(cell.value);
          cell.alignment = { horizontal: "center", vertical: "top" };
        } else {
          cell.alignment = {
            horizontal: "left",
            vertical: "top",
            wrapText: true,
          };
        }
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    saveAs(
      blob,
      `Laporan_Persalinan_${startDate}_${endDate}.xlsx`,
    );
  } catch (error) {
    console.error("Gagal menyusun excel laporan persalinan:", error);
  }
};
