import React, { useState, useEffect } from 'react';
import { Paper, Group, Text, ActionIcon, Stack } from '@mantine/core';
import { IconEye, IconX } from '@tabler/icons-react';

export default function PreviewPanel({ filePath, onClose, isOpen, width }) {
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setPreview(null);
    window.api.readFilePreview(filePath).then((result) => {
      if (!cancelled) {
        setPreview(result);
        setLoading(false);
      }
    }).catch(() => {
      if (!cancelled) {
        setPreview({ type: 'error' });
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [filePath]);

  const fileName = filePath.split('/').pop() || filePath.split('\\').pop();

  return (
    <Paper
      style={{
        width: width,
        height: '100%',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        borderLeft: '1px solid var(--mantine-color-dark-4)',
        overflow: 'hidden',
        opacity: isOpen ? 1 : 0,
        transition: 'opacity 0.2s ease',
      }}
    >
      <Group p="xs" justify="space-between" wrap="nowrap" style={{ flexShrink: 0, borderBottom: '1px solid var(--mantine-color-dark-4)' }}>
        <Group gap="xs" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
          <IconEye size={16} style={{ flexShrink: 0 }} />
          <Text size="sm" fw={600} truncate="end" style={{ minWidth: 0 }} title={fileName}>
            {fileName}
          </Text>
        </Group>
        <ActionIcon size="sm" variant="subtle" color="gray" aria-label="Close preview" title="Close preview" onClick={onClose}>
          <IconX size={14} />
        </ActionIcon>
      </Group>
      <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
        {loading && <Text c="dimmed" size="sm">Loading preview...</Text>}
        {!loading && preview?.type === 'image' && (
          <img
            src={preview.dataUrl}
            alt={fileName}
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 4 }}
          />
        )}
        {!loading && preview?.type === 'text' && (
          <pre style={{
            margin: 0,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            fontFamily: 'monospace',
            fontSize: '0.8rem',
            color: 'var(--mantine-color-gray-4)',
          }}>
            {preview.content}
            {preview.truncated && <Text c="dimmed" size="xs" mt="xs">(truncated)</Text>}
          </pre>
        )}
        {!loading && preview?.type === 'video' && (
          <video controls src={preview.dataUrl} style={{ maxWidth: '100%', borderRadius: 4 }} />
        )}
        {!loading && preview?.type === 'audio' && (
          <audio controls src={preview.dataUrl} style={{ width: '100%' }} />
        )}
        {!loading && (preview?.type === 'unsupported' || preview?.type === 'error') && (
          <Stack align="center" justify="center" style={{ height: '100%' }}>
            <Text c="dimmed" size="sm">Preview not available for this file type.</Text>
          </Stack>
        )}
      </div>
    </Paper>
  );
}