import * as XLSX from 'xlsx-js-style';

export function downloadSampleExcel(dataType: 'projects' | 'teams' | 'organizations' | 'checklists' | 'members') {
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
        active_projects: 'Block-A Foundation, MEP Installation Ph1',
        inactive_projects: '',
      },
      {
        name: 'Audit Team',
        type: 'audit',
        team_lead_name: 'David Williams',
        spoc_name: 'Emma Watson',
        active_projects: '',
        inactive_projects: 'Facade Cladding QC',
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
      {
        'Checklist Name': 'Arch - Beam & Slab Checking',
        'REFERENCE NUMBER': 'PCPL/ARCH/BEAM-SLAB-SHT/2024/0001',
        'Stage Name': 'Single Stage',
        'Checkpoint': 'Slab Shuttering Measurements checked properly?',
        'Type': 'Y/N',
        'Photo': 'FALSE',
        'Remark': 'TRUE',
      },
      {
        'Checklist Name': 'Arch - Beam & Slab Checking',
        'REFERENCE NUMBER': 'PCPL/ARCH/BEAM-SLAB-SHT/2024/0001',
        'Stage Name': 'Single Stage',
        'Checkpoint': 'Dowells for RCC walls is properly kept?',
        'Type': 'Y/N',
        'Photo': 'TRUE',
        'Remark': 'FALSE',
      },
      {
        'Checklist Name': 'Arch - Centreline',
        'REFERENCE NUMBER': 'PCPL/ARCH/CENTRELINE/2024/0001',
        'Stage Name': 'Single Stage',
        'Checkpoint': 'Centerline : Y-Axis Points (to be checked on line-dori fixed on opposite side railings)',
        'Type': 'TEXT',
        'Photo': 'FALSE',
        'Remark': 'TRUE',
      },
    ],
    members: [
      {
        'Name': 'Karan Shah',
        'Email': 'parshwaconstructions2020@gmail.com',
        'Phone No': '9821322140',
        'Access Type': 'Complimentary',
        'Active': 'Yes',
        'Default Role': 'User',
        'Team': 'Parshwa Constructions',
        'Active Assigned Projects': 'CITIZEN CHSL',
        'Inactive Assigned Projects': '',
      },
      {
        'Name': 'Mayuresh Jadhav',
        'Email': 'mayuresh.jadhav@pranavconstructions.com',
        'Phone No': '+919769874571',
        'Access Type': 'Paid',
        'Active': 'Yes',
        'Default Role': 'User',
        'Team': 'Main Team, Phone Contact',
        'Active Assigned Projects': 'AURORA, Training Project, SHINING STAR, ANKUR, MAYUR RESIDENCY, NIRMAL BHAVAN CHSL',
        'Inactive Assigned Projects': '',
      },
      {
        'Name': 'Vishal Tatte',
        'Email': 'vishal.tatte@pranavconstructions.com',
        'Phone No': '+919595530660',
        'Access Type': 'Paid',
        'Active': 'Yes',
        'Default Role': 'User',
        'Team': 'Main Team',
        'Active Assigned Projects': 'Training Project, YOU AND I, VAIBHAV VISTA',
        'Inactive Assigned Projects': '',
      },
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
