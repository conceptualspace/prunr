import React, { useState, useEffect } from 'react';
import {
  Modal,
  Stack,
  Text,
  Group,
  Button,
  Select,
  Textarea,
  Switch,
  NumberInput,
  Box,
  Divider,
  Tooltip,
} from '@mantine/core';
import { IconTrash, IconInfoCircle } from '@tabler/icons-react';
import { DEFAULT_SETTINGS } from './defaults';

const UNIT_MULTIPLIERS = { KB: 1, MB: 1024, GB: 1048576 };

function bestUnit(kb) {
  if (kb >= 1048576 && kb % 1048576 === 0) return 'GB';
  if (kb >= 1024 && kb % 1024 === 0) return 'MB';
  return 'KB';
}

export default function SettingsModal({ opened, onClose, settings, onSave }) {
  const [local, setLocal] = useState(settings);
  const [cacheCleared, setCacheCleared] = useState(false);
  const [unit, setUnit] = useState('KB');

  useEffect(() => {
    if (opened) {
      setLocal(settings);
      setCacheCleared(false);
      setUnit(bestUnit(settings?.minFileSizeKb ?? 0));
    }
  }, [opened, settings]);

  return (
    <Modal padding="xl" opened={opened} onClose={onClose} title="Settings" centered size="md" overlayProps={{ blur: 6 }}>
      <Stack gap="md">
        
        <Box>
          <Group gap={6} mb={4}>
            <Text size="sm" fw={500}>Scan Mode</Text>
            <Tooltip
              multiline
              w={280}
              withArrow
              openDelay={400}
              label="Partial reads a sample of each file for faster scanning but may introduce false positives. Full hashing reads the entire file to guarantee accuracy."
            >
              <IconInfoCircle size={16} style={{ opacity: 0.5 }} />
            </Tooltip>
          </Group>
          <Select
            withCheckIcon={false}
            value={local.scanMode}
            onChange={(v) => setLocal({ ...local, scanMode: v })}
            data={[
              { label: 'Partial SHA-256 (faster)', value: 'partial' },
              { label: 'Full SHA-256 (most accurate)', value: 'full' },
            ]}
            size="xs"
            allowDeselect={false}
            styles={{ input: { cursor: 'default' } }}
          />
        </Box>

  







        

       

                <Group justify="space-between" align="flex-start" wrap="nowrap">
          <Box style={{ flex: 1 }}>
            <Text size="sm" fw={500}>Ignore files smaller than</Text>
   
          </Box>
          <Group gap={8} wrap="nowrap">
            <NumberInput
              value={local.minFileSizeKb / UNIT_MULTIPLIERS[unit]}
              onChange={(v) => {
                const val = Number(v) || 0;
                setLocal({ ...local, minFileSizeKb: Math.round(val * UNIT_MULTIPLIERS[unit]) });
              }}
              min={0}
              w={90}
              size="xs"
              allowNegative={false}
              decimalScale={unit === 'KB' ? 0 : 2}
            />
            <Select
              value={unit}
              onChange={(newUnit) => {
                const displayedVal = local.minFileSizeKb / UNIT_MULTIPLIERS[unit];
                setLocal({ ...local, minFileSizeKb: Math.round(displayedVal * UNIT_MULTIPLIERS[newUnit]) });
                setUnit(newUnit);
              }}
              data={[
                { label: 'KB', value: 'KB' },
                { label: 'MB', value: 'MB' },
                { label: 'GB', value: 'GB' },
              ]}
              w={75}
              size="xs"
              allowDeselect={false}
              styles={{ input: { cursor: 'default' } }}
            />
          </Group>
        </Group>

                      <Switch
          label="Recursive scan"
          description="Scan subdirectories within selected folders"
          checked={local.recursive}
          onChange={(e) => setLocal({ ...local, recursive: e.currentTarget.checked })}
        />

        {/*
        <Switch
          label="Follow symlinks"
          description="Follow symbolic links when scanning directories"
          checked={local.followSymlinks}
          onChange={(e) => setLocal({ ...local, followSymlinks: e.currentTarget.checked })}
        />
        */}

        <Switch
              label="Include hidden files"
              description="Scan files and folders starting with a dot"
              checked={local.showHiddenFiles}
              onChange={(e) => setLocal({ ...local, showHiddenFiles: e.currentTarget.checked })}
            />

         <Group justify="space-between" align="flex-start" wrap="nowrap" mb={"md"}>
          <Switch
            label="Cache scan results"
            //description="Cache file hashes to speed up repeated scans"
            checked={local.cacheEnabled}
            onChange={(e) => setLocal({ ...local, cacheEnabled: e.currentTarget.checked })}
            style={{ flex: 1 }}
          />
          <Button
            variant="light"
            size="xs"
            leftSection={<IconTrash size={14} />}
            disabled={cacheCleared || !local.cacheEnabled}
            onClick={async () => {
              await window.api.clearCache();
              setCacheCleared(true);
            }}
            mt={2}
          >
            {cacheCleared ? 'Cleared' : 'Clear Cache'}
          </Button>
        </Group>
        {/*
         <Textarea
                label="Custom Exclusions"
                value={local.exclusions}
                onChange={(e) => setLocal({ ...local, exclusions: e.currentTarget.value })}
                placeholder={"backup/\n*.tmp"}
                autosize
                minRows={8}
                maxRows={8}
                description="One pattern per line. Directories or glob patterns to skip during scan."
              />
        */}

      </Stack>

      <Group justify="space-between" mt="xl" style={{ flexShrink: 0 }}>
        <Button variant="subtle" size="xs" onClick={() => { setLocal(DEFAULT_SETTINGS); setUnit(bestUnit(DEFAULT_SETTINGS.minFileSizeKb)); }}>Restore Defaults</Button>
        <Group gap="sm">
          <Button variant="default" onClick={onClose}>Cancel</Button>
          <Button onClick={() => { onSave(local); onClose(); }}>Save</Button>
        </Group>
      </Group>
    </Modal>
  );
}
