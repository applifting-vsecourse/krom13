import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"
import { useForm, useWatch } from "react-hook-form"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { MOOD_EMOJI, MOODS, type Mood } from "@/lib/moods"
import { cn } from "@/lib/utils"

import {
  MAX_LENGTH,
  replyFormSchema,
  type ReplyFormValues,
} from "@/features/quack/api/quackFormSchema"
import { useAddReply } from "@/features/quack/hooks/useAddReply"

type ReplyFormProps = {
  /** The quack or reply being answered. */
  targetId: string
  /** Set when answering a reply: shown as "Replying to @name". */
  targetUsername?: string
  onCancelTarget?: () => void
  defaultMood?: Mood
  /** Put the cursor in the text box when the form appears. */
  shouldFocus?: boolean
  className?: string
}

export function ReplyForm({
  targetId,
  targetUsername,
  onCancelTarget,
  defaultMood,
  shouldFocus = false,
  className,
}: ReplyFormProps) {
  const addReply = useAddReply()
  const form = useForm<ReplyFormValues>({
    resolver: zodResolver(replyFormSchema),
    defaultValues: { text: "", mood: defaultMood ?? null },
  })
  const length = (useWatch({ control: form.control, name: "text" }) ?? "").length

  const handleSubmit = (values: ReplyFormValues) => {
    addReply.mutate(
      { quackId: targetId, text: values.text, mood: values.mood ?? undefined },
      {
        // On failure the text stays in the form and the error shows above it.
        onSuccess: () => {
          form.reset({ text: "", mood: defaultMood ?? null })
          onCancelTarget?.()
        },
      },
    )
  }

  return (
    <Form {...form}>
      <form
        noValidate
        onSubmit={form.handleSubmit(handleSubmit)}
        className={cn("space-y-3", className)}
      >
        {targetUsername ? (
          <p className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
            <span>Replying to @{targetUsername}</span>
            {onCancelTarget ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onCancelTarget}
              >
                Cancel
              </Button>
            ) : null}
          </p>
        ) : null}

        {addReply.error ? (
          <Alert variant="destructive">
            <AlertDescription>{addReply.error.message}</AlertDescription>
          </Alert>
        ) : null}

        <FormField
          control={form.control}
          name="text"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Your reply</FormLabel>
              <FormControl>
                <Textarea
                  rows={3}
                  placeholder="Write a reply..."
                  disabled={addReply.isPending}
                  // eslint-disable-next-line jsx-a11y/no-autofocus -- the person just asked to reply here
                  autoFocus={shouldFocus}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="mood"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Mood (optional)</FormLabel>
              <FormControl>
                <ToggleGroup
                  type="single"
                  variant="outline"
                  value={field.value ?? ""}
                  onValueChange={(value) => field.onChange(value === "" ? null : value)}
                  disabled={addReply.isPending}
                  aria-label="Mood"
                  rovingFocus={false}
                >
                  {MOODS.map((mood) => (
                    <ToggleGroupItem
                      key={mood}
                      value={mood}
                      aria-label={mood}
                      title={mood}
                      className="px-3 text-lg"
                    >
                      {MOOD_EMOJI[mood]}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex items-center justify-end gap-3">
          <span
            className={cn(
              "text-sm",
              length > MAX_LENGTH ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {length}/{MAX_LENGTH}
          </span>
          <Button
            type="submit"
            size="sm"
            disabled={addReply.isPending}
          >
            {addReply.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Reply
          </Button>
        </div>
      </form>
    </Form>
  )
}
