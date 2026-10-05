import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { SettingsLinkRow, SettingsNote, SettingsPageHeader, SettingsSection } from '@/components/settings/SettingsUI';

const DataSettings = () => {
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      const { data, error } = await (supabase as any).rpc('export_my_data');
      if (error) throw error;
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `cinecraft-data-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast({ title: 'Download ready', description: 'Message contents are end-to-end encrypted and appear as ciphertext.' });
    } catch {
      toast({ title: 'Export failed', description: 'Please try again.', variant: 'destructive' });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <>
      <SettingsPageHeader title="Download your information" description="Your right to a copy of your data (DPDP Act 2023)." />
      <SettingsSection>
        <SettingsLinkRow
          title={isExporting ? 'Preparing your file…' : 'Download your information'}
          description="Profile, posts, projects, connections and activity as a JSON file"
          onClick={() => !isExporting && handleExportData()}
        />
      </SettingsSection>
      <SettingsNote>We keep your data while your account is active. Deleting your account (Accounts Center) removes it.</SettingsNote>
    </>
  );
};

export default DataSettings;
