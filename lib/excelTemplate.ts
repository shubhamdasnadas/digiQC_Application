import * as XLSX from 'xlsx-js-style';

export function downloadSampleExcel(dataType: 'projects' | 'teams' | 'organizations' | 'checklists') {
  const templates: Record<typeof dataType, Record<string, any>[]> = {
    projects: [
      {
        name: 'Block-A Foundation',
        nomenclature: 'BLK-A-001',
        instruction: 'Inspect all RCC work per IS:456',
        profile: 'Civil structural',
        image_url: 'https://images.pexels.com/photos/1216589/...',
        status: 'active',
      },
      {
        name: 'MEP Installation',
        nomenclature: 'MEP-001',
        instruction: 'Verify electrical and plumbing routes',
        profile: 'MEP services',
        image_url: 'https://images.pexels.com/photos/3862379/...',
        status: 'active',
      },
    ],
    teams: [
      {
        name: 'QC Team Alpha',
        type: 'inspection',
        team_lead_name: 'Rajesh Kumar',
        spoc_name: 'Priya Singh',
      },
      {
        name: 'Audit Team',
        type: 'audit',
        team_lead_name: 'David Williams',
        spoc_name: 'Emma Watson',
      },
    ],
    organizations: [
      {
        name: 'City Hospital',
        user_limit: 50,
        licensing: 'Enterprise',
        expiry_date: '2026-12-31',
        logo_url: '',
        console_uses: 12,
      },
      {
        name: 'Green Ross Infrastructure',
        user_limit: 30,
        licensing: 'Professional',
        expiry_date: '2026-06-30',
        logo_url: '',
        console_uses: 8,
      },
    ],
    checklists: [
      { name: 'Pre-construction Checklist' },
      { name: 'Mid-stage Verification' },
      { name: 'Final Handover QC' },
    ],
  };

  const data = templates[dataType];
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');

  const colWidths = Object.keys(data[0]).map(key => ({
    wch: Math.max(12, key.length, ...(data as any[]).map(row => String(row[key] || '').length)),
  }));
  worksheet['!cols'] = colWidths;

  XLSX.writeFile(workbook, `digiqc-${dataType}-template.xlsx`);
}
