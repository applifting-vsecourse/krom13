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
import { Toggle } from "@/components/ui/toggle"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { MOOD_EMOJI, MOODS, type Mood } from "@/lib/moods"
import { cn } from "@/lib/utils"

import {
  emptyOptions,
  MAX_LENGTH,
  quackFormSchema,
  type QuackFormValues,
} from "@/features/quack/api/quackFormSchema"
import { PollFields } from "@/features/quack/components/PollFields"
import { useAddQuack } from "@/features/quack/hooks/useAddQuack"

type QuackFormProps = {
  className?: string
  // The mood from the user's settings; it only pre-selects the picker.
  defaultMood?: Mood
}

export function QuackForm({ className, defaultMood }: QuackFormProps) {
  const addQuack = useAddQuack()
  const form = useForm<QuackFormValues>({
    resolver: zodResolver(quackFormSchema),
    defaultValues: { text: "", mood: defaultMood ?? null, isPoll: false, options: emptyOptions() },
  })

  const text = useWatch({ control: form.control, name: "text" })
  const length = text?.length ?? 0

  const isPoll = useWatch({ control: form.control, name: "isPoll" })

  const handleSubmit = (values: QuackFormValues) => {
    addQuack.mutate(
      {
        text: values.text,
        mood: values.mood ?? undefined,
        poll: values.isPoll
          ? { options: values.options.map((option) => option.text.trim()) }
          : undefined,
      },
      {
        onSuccess: () =>
          form.reset({
            text: "",
            mood: defaultMood ?? null,
            isPoll: false,
            options: emptyOptions(),
          }),
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
        {addQuack.error ? (
          <Alert variant="destructive">
            <AlertDescription>{addQuack.error.message}</AlertDescription>
          </Alert>
        ) : null}

        <FormField
          control={form.control}
          name="text"
          render={({ field }) => (
            <FormItem>
              <FormLabel>New quack</FormLabel>
              <FormControl>
                <Textarea
                  rows={3}
                  placeholder="Quack something..."
                  disabled={addQuack.isPending}
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
                  disabled={addQuack.isPending}
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

        <FormField
          control={form.control}
          name="isPoll"
          render={({ field }) => (
            <FormItem>
              <Toggle
                variant="outline"
                size="sm"
                pressed={field.value}
                onPressedChange={field.onChange}
                disabled={addQuack.isPending}
              >
                Add poll
              </Toggle>
            </FormItem>
          )}
        />

        {isPoll ? (
          <PollFields
            control={form.control}
            isDisabled={addQuack.isPending}
          />
        ) : null}

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
            disabled={addQuack.isPending}
          >
            {addQuack.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Quack
          </Button>
        </div>
      </form>
    </Form>
  )
}
