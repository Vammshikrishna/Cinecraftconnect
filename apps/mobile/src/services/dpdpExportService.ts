import { Share, Platform } from 'react-native';
import { getSupabaseClient } from '@cinecraft/api';

export interface DpdpExportResult {
  success: boolean;
  itemCounts?: Record<string, number>;
  error?: string;
}

/**
 * DPDP Act 2023 / GDPR: right of access & portability.
 * The export is assembled server-side (export_my_data RPC) so it covers every table the user owns and
 * uses the real column names; the app only shares the resulting JSON through the system share sheet.
 */
export async function exportUserDataDPDP(_userId?: string): Promise<DpdpExportResult> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await (supabase as any).rpc('export_my_data');
    if (error) throw error;
    if (!data) throw new Error('The export returned no data.');

    const archive = {
      ...data,
      metadata: {
        export_format: 'JSON',
        platform: 'CineCraft Connect Mobile',
        os_platform: Platform.OS,
      },
    };

    const itemCounts: Record<string, number> = {};
    Object.entries(archive).forEach(([key, value]) => {
      if (Array.isArray(value)) itemCounts[key] = value.length;
    });

    const exportDate = new Date().toISOString().split('T')[0];
    const shareResult = await Share.share(
      {
        title: `CineCraft_Data_Export_${exportDate}.json`,
        message: JSON.stringify(archive, null, 2),
      },
      { dialogTitle: 'Save or share your personal data export' }
    );

    return { success: shareResult.action !== Share.dismissedAction, itemCounts };
  } catch (error: any) {
    console.error('[DPDPExport] Error generating export:', error);
    return { success: false, error: error?.message || 'Failed to generate personal data export.' };
  }
}
